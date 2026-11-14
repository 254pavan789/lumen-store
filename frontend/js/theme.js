/**
 * Light / dark theme.
 * - First visit follows the operating system; the toggle stores an explicit choice.
 * - Switching uses the View Transitions API: the new theme grows as a circle
 *   from the toggle button (falls back to an instant switch, and to a plain
 *   switch when reduced motion is requested).
 */
const KEY = 'lumen.theme';
const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function storedTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch (e) {
    return null;
  }
}

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c0c0f' : '#f6f6f3');
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', theme === 'dark');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
  });
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export function setTheme(theme, origin) {
  try {
    localStorage.setItem(KEY, theme);
  } catch (e) {
    /* private mode: still switch for this page */
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce || !origin) {
    apply(theme);
    return;
  }
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.documentElement.classList.add('theme-switching');
  const t = document.startViewTransition(() => apply(theme));
  t.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    })
    .catch(() => {});
  t.finished.finally(() => document.documentElement.classList.remove('theme-switching'));
}

export function toggleTheme(origin) {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark', origin);
}

/** Sun/moon button; the icon morphs with CSS based on html[data-theme]. */
export function themeToggleHtml(key = 'x') {
  const dark = currentTheme() === 'dark';
  // `key` only makes the SVG mask id unique; it must never become a class name
  // (a class like "hub" would pick up layout styles meant for other elements).
  return `<button type="button" class="theme-toggle tt-${key}" data-theme-toggle aria-pressed="${dark}" aria-label="${dark ? 'Switch to light mode' : 'Switch to dark mode'}" title="${dark ? 'Light mode' : 'Dark mode'}">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <mask id="tt-mask-${key}"><rect x="0" y="0" width="24" height="24" fill="#fff"/><circle class="tt-cut" cx="24" cy="4" r="8" fill="#000"/></mask>
      <circle class="tt-core" cx="12" cy="12" r="5" fill="currentColor" mask="url(#tt-mask-${key})"/>
      <g class="tt-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 1.5v2M12 20.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M1.5 12h2M20.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>
      </g>
    </svg>
  </button>`;
}

export function initTheme() {
  apply(storedTheme() || (mq.matches ? 'dark' : 'light'));
  mq.addEventListener('change', (e) => {
    if (!storedTheme()) apply(e.matches ? 'dark' : 'light');
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    e.preventDefault();
    toggleTheme(btn);
  });
}
