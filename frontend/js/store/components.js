/**
 * Reusable storefront pieces: product card, cart control (add button / stepper),
 * save button, rails - plus one delegated click handler for all of them.
 */
import { esc, icon, money, toast } from '../ui.js';
import { productArt } from './art.js';
import { cart, saved } from './cart.js';
import { getProduct } from './catalog.js';
import { bump, flyToCart } from './motion.js';

export const LOW_STOCK = 5;

export function stockInfo(p) {
  const n = Number(p.stock_available || 0);
  if (n <= 0) return { tone: 'out', label: 'Currently unavailable', badge: 'Sold out', badgeCls: 'dark' };
  if (n <= LOW_STOCK) return { tone: 'low', label: `Only ${n} left`, badge: `Only ${n} left`, badgeCls: 'orange' };
  return { tone: 'in', label: `${n} in stock`, badge: '', badgeCls: '' };
}

/** Add button, quantity stepper, or "Sold out" - depending on cart state and stock. */
export function cartControl(p, { size = '' } = {}) {
  const stock = Number(p.stock_available || 0);
  const qty = cart.qty(p.id);
  let inner;
  if (stock <= 0) {
    inner = '<span class="soldout-text">Sold out</span>';
  } else if (qty > 0) {
    inner = `
      <div class="stepper ${size}" role="group" aria-label="Quantity of ${esc(p.name)} in cart">
        <button type="button" data-act="dec" data-id="${p.id}" aria-label="${qty === 1 ? 'Remove from cart' : 'Decrease quantity'}">${icon(qty === 1 ? 'trash' : 'minus')}</button>
        <output aria-live="polite">${qty}</output>
        <button type="button" data-act="inc" data-id="${p.id}" aria-label="Increase quantity" ${qty >= stock ? 'disabled title="No more stock available"' : ''}>${icon('plus')}</button>
      </div>`;
  } else {
    inner = `<button type="button" class="add-btn" data-act="add" data-id="${p.id}" aria-label="Add ${esc(p.name)} to cart">${icon('plus')}</button>`;
  }
  return `<div class="cart-ctl" data-cart-ctl="${p.id}" data-size="${size}">${inner}</div>`;
}

export function saveButton(p) {
  const on = saved.has(p.id);
  return `<button type="button" class="save-btn ${on ? 'on' : ''}" data-act="save" data-id="${p.id}" aria-pressed="${on}" aria-label="${on ? 'Remove from saved' : 'Save for later'}">${icon('heart')}</button>`;
}

export function productCard(p, { bestseller = false } = {}) {
  const s = stockInfo(p);
  const flags = [
    bestseller && s.tone !== 'out' ? '<span class="badge dark plain">Bestseller</span>' : '',
    s.badge ? `<span class="badge ${s.badgeCls} plain">${esc(s.badge)}</span>` : '',
  ].join('');
  return `
    <article class="pcard ${s.tone === 'out' ? 'is-out' : ''}" data-product="${p.id}">
      <div class="media-wrap">
        <a class="media" href="#/product/${p.id}" aria-label="${esc(p.name)}" data-fly-src>
          ${productArt(p, { soldOut: s.tone === 'out' })}
        </a>
        <div class="flags">${flags}</div>
        ${saveButton(p)}
        <button type="button" class="qv-btn" data-act="quick" data-id="${p.id}" aria-label="Quick view ${esc(p.name)}">${icon('eye')}Quick view</button>
      </div>
      <div class="body">
        <span class="cat">${esc(p.type_name)}</span>
        <a class="title" href="#/product/${p.id}">${esc(p.name)}</a>
        <div class="bottom">
          <div>
            <div class="price">${money(p.price)}</div>
            <div class="stockline ${s.tone}"><i></i>${esc(s.label)}</div>
          </div>
          ${cartControl(p)}
        </div>
      </div>
    </article>`;
}

export function productGrid(products, opts = {}) {
  const best = new Set(opts.bestsellers || []);
  return products.map((p) => productCard(p, { bestseller: best.has(p.id) })).join('');
}

export function rail(id, products, opts = {}) {
  return `<div class="rail" id="${id}">${productGrid(products, opts)}</div>`;
}

export function railNav(id) {
  return `<div class="rail-nav">
    <button class="btn outline" data-rail="${id}" data-dir="-1" aria-label="Scroll left">${icon('chev-left')}</button>
    <button class="btn outline" data-rail="${id}" data-dir="1" aria-label="Scroll right">${icon('chev-right')}</button>
  </div>`;
}

/** Re-render every cart control / save button of one product currently on screen. */
export function refreshProductUI(id) {
  const p = getProduct(id);
  if (!p) return;
  document.querySelectorAll(`[data-cart-ctl="${p.id}"]`).forEach((el) => {
    el.outerHTML = cartControl(p, { size: el.dataset.size || '' });
  });
}

function refreshSave(id) {
  const on = saved.has(id);
  document.querySelectorAll(`.save-btn[data-id="${id}"]`).forEach((btn) => {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on);
    btn.setAttribute('aria-label', on ? 'Remove from saved' : 'Save for later');
    if (on) {
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }
  });
}

let bound = false;

/** One delegated handler for add / inc / dec / save / rail scroll anywhere in the store. */
export function bindStoreActions() {
  if (bound) return;
  bound = true;

  cart.subscribe((detail) => {
    if (detail && detail.id) refreshProductUI(detail.id);
    else document.querySelectorAll('[data-cart-ctl]').forEach((el) => refreshProductUI(el.dataset.cartCtl));
  });
  saved.subscribe((detail) => {
    if (detail && detail.id) refreshSave(detail.id);
  });

  document.addEventListener('click', (e) => {
    const railBtn = e.target.closest('[data-rail]');
    if (railBtn) {
      const el = document.getElementById(railBtn.dataset.rail);
      if (el) el.scrollBy({ left: Number(railBtn.dataset.dir) * el.clientWidth * 0.85, behavior: 'smooth' });
      return;
    }

    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    if (!['add', 'inc', 'dec', 'save', 'quick'].includes(act)) return;
    e.preventDefault();
    e.stopPropagation();
    const p = getProduct(btn.dataset.id);
    if (!p) return;

    if (act === 'quick') {
      import('./quickview.js').then((mod) => mod.openQuickView(p, btn));
      return;
    }
    if (act === 'save') {
      const on = saved.toggle(p.id);
      toast(on ? `Saved ${p.name}` : `Removed ${p.name} from saved`, 'info', { timeout: 2200 });
      return;
    }
    if (act === 'add') {
      const before = cart.qty(p.id);
      const qty = cart.add(p.id, Number(btn.dataset.qty || 1), p.stock_available);
      if (qty === before) {
        toast(`Only ${p.stock_available} ${p.name} available`, 'error');
        return;
      }
      const card = btn.closest('[data-product]') || document;
      flyToCart(card.querySelector('[data-fly-src]'));
      return;
    }
    if (act === 'inc') {
      const before = cart.qty(p.id);
      const qty = cart.add(p.id, 1, p.stock_available);
      if (qty === before) toast(`That's all we have — ${p.stock_available} in stock`, 'info', { timeout: 2400 });
      else bump(document.getElementById('cart-btn'));
      return;
    }
    if (act === 'dec') {
      const qty = cart.qty(p.id);
      if (qty <= 1) {
        cart.remove(p.id);
        toast(`Removed ${p.name}`, 'info', {
          timeout: 4000,
          action: { label: 'Undo', onClick: () => cart.set(p.id, 1, p.stock_available) },
        });
      } else {
        cart.set(p.id, qty - 1, p.stock_available);
      }
    }
  });
}

// ---------------------------------------------------------------- recently viewed
const RECENT_KEY = 'lumen.recent.v1';

export function recordRecent(id) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => x !== Number(id));
    list.unshift(Number(id));
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)));
  } catch (e) {
    /* storage unavailable */
  }
}

export function recentProducts(excludeId) {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
      .filter((id) => id !== Number(excludeId))
      .map((id) => getProduct(id))
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}
