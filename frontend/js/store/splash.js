/**
 * Startup screen. Plays once per browser session while the store warms up
 * (health check + catalogue). Progress is real, not a fake timer; the
 * minimum display time only lets the logo animation finish.
 */
import { api } from '../api.js';
import { logoMark } from '../ui.js';
import { loadCatalog } from './catalog.js';
import { reducedMotion } from './motion.js';

const SEEN_KEY = 'lumen.splash.seen';
const MIN_MS = 1900;

function markup() {
  const word = 'Lumen'
    .split('')
    .map((ch, i) => `<span style="animation-delay:${520 + i * 55}ms">${ch}</span>`)
    .join('');
  return `
    <div class="splash-inner">
      ${logoMark('splash-mark', 'spl')}
      <div class="splash-word" aria-label="Lumen">${word}</div>
      <p class="splash-tag">Everyday essentials · live inventory</p>
      <div class="splash-progress" role="progressbar" aria-label="Loading store" aria-valuemin="0" aria-valuemax="100"><i></i></div>
      <div class="splash-status" aria-live="polite">Opening the store…</div>
      <div class="splash-error" role="alert">
        <strong>We can’t reach the store right now</strong>
        <span class="muted" id="splash-err-msg">Make sure the server and MySQL are running.</span>
        <button class="btn primary" id="splash-retry">Try again</button>
      </div>
    </div>
    <button class="splash-skip" id="splash-skip">Skip intro</button>`;
}

export function shouldShowSplash() {
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch (e) {
    return false;
  }
}

export function runSplash() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'splash';
    el.id = 'splash';
    el.innerHTML = markup();
    document.body.appendChild(el);
    document.body.classList.add('no-scroll');

    const bar = el.querySelector('.splash-progress');
    const fill = bar.querySelector('i');
    const status = el.querySelector('.splash-status');
    const started = performance.now();
    let finished = false;

    const progress = (value, text) => {
      fill.style.transform = `scaleX(${Math.max(0.04, value)})`;
      bar.setAttribute('aria-valuenow', Math.round(value * 100));
      if (text) status.textContent = text;
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch (e) {
        /* private mode */
      }
      el.classList.add('leaving');
      document.body.classList.remove('no-scroll');
      setTimeout(() => el.remove(), reducedMotion() ? 220 : 560);
      resolve();
    };

    const load = async () => {
      el.classList.remove('error');
      progress(0.12, 'Opening the store…');
      try {
        await api.health();
        progress(0.45, 'Checking live stock…');
        await loadCatalog({ force: true });
        progress(0.9, 'Arranging the shelves…');
        const wait = (reducedMotion() ? 300 : MIN_MS) - (performance.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        progress(1, 'Welcome in');
        setTimeout(finish, reducedMotion() ? 50 : 260);
      } catch (error) {
        el.classList.add('error');
        el.querySelector('#splash-err-msg').textContent =
          error.status === 503 ? 'The database is offline. Start MySQL and try again.' : error.message;
      }
    };

    el.querySelector('#splash-skip').addEventListener('click', finish);
    el.querySelector('#splash-retry').addEventListener('click', load);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && !el.classList.contains('error')) {
        document.removeEventListener('keydown', onKey);
        finish();
      }
    });
    requestAnimationFrame(() => progress(0.06));
    load();
  });
}
