'use strict';

/**
 * PythonBridge
 * ------------
 * Starts engine/engine.py once as a long-lived child process and talks to it
 * with newline-delimited JSON over stdin/stdout. Every API request becomes
 * one message: { id, action, payload } -> { id, status, body }.
 *
 *  - requests are matched to responses by id (the engine is multi-threaded,
 *    so answers may arrive out of order)
 *  - a timeout protects the HTTP request if the engine hangs
 *  - if the engine crashes it is restarted automatically and pending
 *    requests receive a safe 503 response
 */
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const ENGINE_PATH = path.resolve(__dirname, '..', '..', 'engine', 'engine.py');

function pythonCandidates(explicit) {
  if (explicit) return [explicit];
  // Windows installs usually provide "python" and/or the "py" launcher
  return process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
}

class PythonBridge {
  constructor(options = {}) {
    this.candidates = pythonCandidates(options.pythonPath || (process.env.PYTHON_PATH || '').trim());
    this.candidateIndex = 0;
    this.pythonPath = this.candidates[0];
    this.timeoutMs = Number(options.timeoutMs || process.env.ENGINE_TIMEOUT_MS || 15000);
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.ready = false;
    this.readyWaiters = [];
    this.stopping = false;
    this.restartDelay = 500;
    this.lastStartError = null;
  }

  start() {
    this.stopping = false;
    this.ready = false;
    const child = spawn(this.pythonPath, ['-u', ENGINE_PATH], {
      cwd: path.dirname(ENGINE_PATH),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;

    readline.createInterface({ input: child.stdout }).on('line', (line) => this.onLine(line));
    readline.createInterface({ input: child.stderr }).on('line', (line) => {
      console.log(line.startsWith('[engine]') ? line : `[engine] ${line}`);
    });

    child.on('error', (err) => {
      this.lastStartError = err;
      if (err.code === 'ENOENT' && this.candidateIndex < this.candidates.length - 1) {
        this.candidateIndex += 1;
        console.warn(`[bridge] "${this.pythonPath}" not found, trying "${this.candidates[this.candidateIndex]}"`);
        this.pythonPath = this.candidates[this.candidateIndex];
        this.child = null; // its exit event (if any) is ignored below
        setImmediate(() => this.start());
        return;
      }
      if (err.code === 'ENOENT') {
        this.stopping = true; // nothing to restart
        this.child = null;
        console.error(
          `\n[bridge] Python executable "${this.pythonPath}" was not found.\n` +
            '         Install Python 3.9+ and/or set PYTHON_PATH in .env (e.g. PYTHON_PATH=py or full path to python.exe).\n'
        );
      } else {
        console.error('[bridge] failed to start Python engine:', err.message);
      }
    });

    child.on('exit', (code, signal) => {
      if (this.child !== child) return; // stale process (e.g. failed Python candidate)
      this.ready = false;
      this.child = null;
      this.failAll(503, 'ENGINE_UNAVAILABLE', 'Processing engine restarted. Please retry the request.');
      if (this.stopping) return;
      if (code === 3) {
        console.error('[bridge] Python dependencies are missing (see message above). Fix them and restart the server.');
        return;
      }
      console.error(`[bridge] Python engine exited (code=${code}, signal=${signal}). Restarting in ${this.restartDelay}ms`);
      setTimeout(() => this.start(), this.restartDelay);
      this.restartDelay = Math.min(this.restartDelay * 2, 10000);
    });

    child.stdin.on('error', () => {
      /* engine went away mid-write; exit handler deals with it */
    });
    return this;
  }

  onLine(line) {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch (err) {
      console.error('[bridge] non-JSON output from engine:', text.slice(0, 200));
      return;
    }
    if (message.type === 'ready') {
      this.ready = true;
      this.restartDelay = 500;
      console.log(`[bridge] Python engine ready (v${message.engine_version}, python ${message.python})`);
      this.readyWaiters.splice(0).forEach((resolve) => resolve());
      return;
    }
    const entry = this.pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(message.id);
    entry.resolve({ status: message.status || 500, body: message.body });
  }

  waitUntilReady(ms = 10000) {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('engine not ready')), ms);
      this.readyWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Send one action to the Python engine.
   * Always resolves (never rejects) with { status, body } so routes stay simple.
   */
  async call(action, payload = {}) {
    if (!this.child) {
      return errorResult(503, 'ENGINE_UNAVAILABLE', 'Processing engine is not running. Check the server log.');
    }
    if (!this.ready) {
      try {
        await this.waitUntilReady();
      } catch (e) {
        return errorResult(503, 'ENGINE_UNAVAILABLE', 'Processing engine is starting. Please retry in a moment.');
      }
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(errorResult(504, 'ENGINE_TIMEOUT', 'The request took too long to process. Please retry.'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      try {
        this.child.stdin.write(JSON.stringify({ id, action, payload }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve(errorResult(503, 'ENGINE_UNAVAILABLE', 'Processing engine is not available.'));
      }
    });
  }

  failAll(status, code, message) {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve(errorResult(status, code, message));
      this.pending.delete(id);
    }
  }

  stop() {
    this.stopping = true;
    if (this.child) {
      try {
        this.child.stdin.end();
      } catch (e) {
        /* ignore */
      }
      const child = this.child;
      setTimeout(() => child && !child.killed && child.kill(), 2000).unref();
    }
  }
}

function errorResult(status, code, message) {
  return { status, body: { success: false, error: { code, message } } };
}

module.exports = { PythonBridge, errorResult };
