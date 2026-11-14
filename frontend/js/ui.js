/**
 * Shared UI helpers: escaping, formatting, badges, icons, toasts,
 * confirmation dialogs and server-error -> form-field mapping.
 */

// ------------------------------------------------------------------ icons
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6"/>',
  'plus-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  power: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0"/><path d="M12 2v10"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  bag: '<path d="M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  minus: '<path d="M5 12h14"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  'chev-right': '<path d="M9 18l6-6-6-6"/>',
  'chev-left': '<path d="M15 18l-6-6 6-6"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l4 4v3h-8z"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/>',
  shield: '<path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  zap: '<path d="M13 2L3 14h8l-1 8 10-12h-8z"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  package: '<path d="M16.5 9.4L7.5 4.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  rupee: '<path d="M6 3h12M6 8h12M14.5 21L6 13h3a5 5 0 0 0 0-10"/>',
  trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon);
  });
}

// ------------------------------------------------------------------ text
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 2026-08-25 -> 25-08-2026 (display format used in the assignment) */
export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : esc(iso);
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const [date, time = ''] = String(value).split(/[ T]/);
  return `${fmtDate(date)} ${time.slice(0, 5)}`.trim();
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

const MONEY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 54999 -> ₹54,999 ; 250.5 -> ₹250.50 */
export function money(value) {
  const n = Number(value || 0);
  if (Number.isInteger(n)) return MONEY.format(n).replace(/\.00$/, '');
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
}

/** Brand logo mark (shopping bag with a spark) */
export function logoMark(cls = 'mark', idSuffix = 'l') {
  return `<svg class="${cls}" viewBox="0 0 96 96" aria-hidden="true">
    <defs><linearGradient id="lg-${idSuffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset=".6" stop-color="#7c3aed"/><stop offset="1" stop-color="#c026d3"/></linearGradient>
    <clipPath id="lc-${idSuffix}"><rect width="96" height="96" rx="26"/></clipPath></defs>
    <rect class="tile" width="96" height="96" rx="26" fill="url(#lg-${idSuffix})"/>
    <g clip-path="url(#lc-${idSuffix})"><rect class="shine" x="-10" y="-20" width="26" height="140" fill="#fff" opacity="0" transform="rotate(20)"/></g>
    <path class="bag" d="M28 38h40l-3 34a5 5 0 0 1-5 4.5H36a5 5 0 0 1-5-4.5z" fill="none" stroke="#fff" stroke-width="5.5" stroke-linejoin="round"/>
    <path class="handle" d="M38 40v-6a10 10 0 0 1 20 0v6" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>
    <path class="spark" d="M70 20l2.6 6.4L79 29l-6.4 2.6L70 38l-2.6-6.4L61 29l6.4-2.6z" fill="#fff"/>
  </svg>`;
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function signed(n) {
  const v = Number(n || 0);
  if (v > 0) return `<span class="delta-pos">+${fmtNum(v)}</span>`;
  if (v < 0) return `<span class="delta-neg">−${fmtNum(Math.abs(v))}</span>`;
  return '<span class="muted">0</span>';
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ------------------------------------------------------------------ badges
export function availabilityBadge(value) {
  const tone = value === 'In Stock' ? 'green' : value === 'Low Stock' ? 'orange' : 'red';
  return `<span class="badge ${tone}">${esc(value)}</span>`;
}

export function statusBadge(active) {
  return active ? '<span class="badge blue">Active</span>' : '<span class="badge">Inactive</span>';
}

export function purchaseStatusBadge(status) {
  return status === 'CANCELLED'
    ? '<span class="badge red">Cancelled</span>'
    : '<span class="badge green">Completed</span>';
}

export function availabilityTone(value) {
  return value === 'In Stock' ? '' : value === 'Low Stock' ? 'orange' : 'red';
}

// ------------------------------------------------------------------ layout pieces
export function pageHead({ title, subtitle = '', crumbs = [], actions = '' }) {
  const crumbHtml = crumbs.length
    ? `<div class="crumbs">${crumbs
        .map((c) => (c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`))
        .join('<span aria-hidden="true">›</span>')}</div>`
    : '';
  return `
    <header class="page-head">
      <div>
        ${crumbHtml}
        <h1>${title}</h1>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </header>`;
}

export function skeletonRows(n = 5) {
  return Array.from({ length: n }, (_, i) => `<div class="skeleton skeleton-row" style="width:${92 - i * 9}%"></div>`).join('');
}

export function emptyState({ iconName = 'box', title, text = '', action = '' }) {
  return `<div class="empty">${icon(iconName)}<h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;
}

export function errorState(error, retryHref = '') {
  const status = error && error.status ? ` (HTTP ${error.status})` : '';
  return `
    <div class="card"><div class="card-body">
      <div class="notice error">${icon('alert')}
        <div><strong>Could not load data${status}</strong><br>${esc(error ? error.message : 'Unknown error')}
        ${retryHref !== null ? `<div style="margin-top:10px"><button class="btn sm" onclick="location.reload()">${icon('refresh')}Retry</button></div>` : ''}
        </div>
      </div>
    </div></div>`;
}

/** Render an API error (with details) as a notice block */
export function errorNotice(error, title = 'Please fix the following') {
  const details = (error.details || []).filter((d) => d && d.message);
  const list =
    details.length > 1 ? `<ul>${details.map((d) => `<li>${esc(d.message)}</li>`).join('')}</ul>` : '';
  const heading = details.length > 1 ? `${esc(title)}: ${esc(error.message)}` : esc(error.message);
  return `<div class="notice error" role="alert">${icon('alert')}<div><strong>${heading}</strong>${list}</div></div>`;
}

// ------------------------------------------------------------------ toasts
export function toast(message, type = 'success', { title = '', list = [], timeout, action = null } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle';
  el.innerHTML = `
    ${icon(iconName)}
    <div style="flex:1;min-width:0">
      ${title ? `<div class="t-title">${esc(title)}</div><div class="t-body">${esc(message)}</div>` : `<div class="t-title">${esc(message)}</div>`}
      ${list.length ? `<ul>${list.slice(0, 6).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>
    ${action ? `<button class="t-action">${esc(action.label)}</button>` : ''}
    <button class="close" aria-label="Dismiss">${icon('x')}</button>`;
  root.appendChild(el);
  // keep at most 4 toasts
  while (root.children.length > 3) root.firstElementChild.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));

  const dismiss = () => {
    if (el.classList.contains('hide')) return;
    el.classList.add('hide');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  el.querySelector('.close').addEventListener('click', dismiss);
  if (action) {
    el.querySelector('.t-action').addEventListener('click', () => {
      dismiss();
      action.onClick();
    });
  }
  setTimeout(dismiss, timeout || (type === 'error' ? 7000 : 4200));
  return dismiss;
}

export function toastError(error, fallback = 'Something went wrong') {
  const details = (error && error.details ? error.details : []).map((d) => d.message).filter(Boolean);
  toast(error && error.message ? error.message : fallback, 'error', {
    list: details.length > 1 ? details : [],
  });
}

// ------------------------------------------------------------------ dialogs
/**
 * Confirmation dialog. Resolves to false (cancelled) or { value } (confirmed).
 * opts: { title, message, confirmText, tone: 'danger'|'primary', iconName, input: { label, value, placeholder, required, maxLength } }
 */
export function confirmDialog(opts) {
  const {
    title,
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    tone = 'primary',
    iconName = tone === 'danger' ? 'alert' : 'info',
    input = null,
  } = opts;
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${tone === 'danger' ? 'danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="m-title">
        <div class="m-icon">${icon(iconName)}</div>
        <h2 id="m-title">${esc(title)}</h2>
        <div class="m-body">${message}</div>
        ${
          input
            ? `<div class="field">
                 <label for="m-input">${esc(input.label || '')}</label>
                 <input id="m-input" class="input" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}" maxlength="${input.maxLength || 255}" autocomplete="off" />
                 <div class="error-text">${icon('alert')}<span></span></div>
               </div>`
            : ''
        }
        <div class="m-actions">
          <button class="btn" data-act="cancel">${esc(cancelText)}</button>
          <button class="btn ${tone === 'danger' ? 'danger' : 'primary'}" data-act="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    root.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

    const field = overlay.querySelector('.field');
    const inputEl = overlay.querySelector('#m-input');
    const okBtn = overlay.querySelector('[data-act="ok"]');
    (inputEl || okBtn).focus();
    if (inputEl) inputEl.select();

    const close = (result) => {
      overlay.classList.add('closing');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => overlay.remove(), 170);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(result);
    };
    const confirm = () => {
      if (inputEl && input.required && !inputEl.value.trim()) {
        field.classList.add('invalid');
        field.querySelector('.error-text span').textContent = `${input.label} is required`;
        inputEl.focus();
        return;
      }
      close({ value: inputEl ? inputEl.value.trim() : true });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter' && inputEl && document.activeElement === inputEl) {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Tab') {
        const focusables = [...overlay.querySelectorAll('button, input')];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    okBtn.addEventListener('click', confirm);
  });
}

// ------------------------------------------------------------------ forms
export function clearFieldErrors(form) {
  form.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
}

export function setFieldError(form, field, message) {
  const wrap = form.querySelector(`.field[data-field="${field}"]`);
  if (!wrap) return false;
  wrap.classList.add('invalid');
  const target = wrap.querySelector('.error-text span');
  if (target) target.textContent = message;
  return true;
}

/** Map API error details onto fields; returns details that had no matching field. */
export function applyFieldErrors(form, error) {
  const unmatched = [];
  (error.details || []).forEach((d) => {
    if (!d.field || !setFieldError(form, d.field, d.message)) unmatched.push(d);
  });
  const firstInvalid = form.querySelector('.field.invalid .input, .field.invalid input');
  if (firstInvalid) firstInvalid.focus();
  return unmatched;
}

export function fieldErrorSlot() {
  return `<div class="error-text">${icon('alert')}<span></span></div>`;
}

export function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle('loading', loading);
}
