/**
 * One overlay system for the store: right drawer (cart), left drawer (filters)
 * and centred modal (quick view). On phones every variant becomes a bottom
 * sheet with a grab handle and drag-to-dismiss.
 */
import { sheetDrag } from './motion.js';

const mobile = () => window.matchMedia('(max-width: 720px)').matches;
let active = null;

export function closeOverlay() {
  if (active) active.close();
}

/**
 * @param {string} html   inner HTML of the panel
 * @param {object} opts   { variant: 'right' | 'left' | 'modal', label, onClose, className }
 * @returns {{ panel: HTMLElement, close: Function }}
 */
export function openOverlay(html, opts = {}) {
  if (active) active.close(true);
  const variant = opts.variant || 'right';
  const root = document.getElementById('drawer-root');
  const sheet = mobile();
  const lastFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  const panel = document.createElement('aside');
  panel.className = `drawer ${variant === 'left' ? 'left' : ''} ${variant === 'modal' ? 'modal-panel' : ''} ${sheet ? 'sheet' : ''} ${opts.className || ''}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  if (opts.label) panel.setAttribute('aria-label', opts.label);
  panel.innerHTML = `${sheet ? '<div class="sheet-handle" aria-hidden="true"><span></span></div>' : ''}${html}`;

  root.innerHTML = '';
  root.append(overlay, panel);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      panel.classList.add('open');
    })
  );

  let closed = false;
  const close = (immediate = false) => {
    if (closed) return;
    closed = true;
    active = null;
    document.removeEventListener('keydown', onKey, true);
    panel.style.transform = '';
    overlay.classList.remove('open');
    panel.classList.remove('open');
    document.body.classList.remove('no-scroll');
    const remove = () => {
      overlay.remove();
      panel.remove();
    };
    if (immediate) remove();
    else setTimeout(remove, 420);
    if (opts.onClose) opts.onClose();
    if (lastFocus && lastFocus.focus && !immediate) lastFocus.focus({ preventScroll: true });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', () => close());
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });

  if (sheet) {
    const handle = panel.querySelector('.sheet-handle');
    const head = panel.querySelector('.drawer-head');
    sheetDrag(panel, handle, () => close());
    if (head) sheetDrag(panel, head, () => close());
  }

  setTimeout(() => {
    const first = panel.querySelector('[data-autofocus]') || panel.querySelector('.icon-btn, button, a[href]');
    if (first) first.focus({ preventScroll: true });
  }, 60);

  active = { close, panel };
  return active;
}
