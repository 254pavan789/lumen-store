/**
 * Storefront chrome: header (logo, nav, live search, saved, cart), footer,
 * mobile tab bar and the cart drawer.
 */
import { esc, icon, logoMark, money } from '../ui.js';
import { themeToggleHtml } from '../theme.js';
import { navigate } from '../state.js';
import { productThumb } from './art.js';
import { cart, saved } from './cart.js';
import { getCategories, getProduct, loadCatalog, searchProducts } from './catalog.js';
import { cartControl, stockInfo } from './components.js';
import { countUp } from './motion.js';
import { openOverlay } from './overlay.js';

export function renderStoreShell(root) {
  root.innerHTML = `
    <header class="s-header" id="s-header">
      <div class="container bar">
        <a class="logo" href="#/" aria-label="Lumen home">${logoMark('mark', 'hdr')}<span>Lumen</span></a>
        <nav class="s-nav" aria-label="Store">
          <a href="#/" data-nav="home">Home</a>
          <a href="#/shop" data-nav="shop">Shop</a>
          <a href="#/orders" data-nav="orders">Orders</a>
        </nav>
        <div class="s-search" id="s-search" role="search">
          ${icon('search')}
          <input class="input" id="search-input" type="search" placeholder="Search products, categories…" autocomplete="off"
            aria-label="Search products" aria-autocomplete="list" aria-controls="search-pop" aria-expanded="false" />
          <kbd aria-hidden="true">/</kbd>
          <div class="search-pop" id="search-pop" role="listbox"></div>
        </div>
        <div class="s-actions">
          <a class="icon-btn hide-sm" href="#/saved" aria-label="Saved items" id="saved-btn">${icon('heart')}<span class="count-dot" id="saved-count" hidden></span></a>
          ${themeToggleHtml('hdr')}
          <a class="hub-link" href="#/admin" title="Seller Hub – manage products, stock and orders" aria-label="Seller Hub">${icon('store')}<span class="lbl">Seller Hub</span></a>
          <button class="cart-btn" id="cart-btn" aria-label="Open cart">${icon('bag')}<span class="lbl">Cart</span><span class="n" id="cart-count">0</span></button>
        </div>
      </div>
    </header>
    <main id="view" class="store-main" tabindex="-1"></main>
    <footer class="s-footer">
      <div class="container">
        <div class="foot-top">
          <div class="foot-brand">
            <a class="logo" href="#/">${logoMark('mark', 'ftr')}<span>Lumen</span></a>
            <p>Everyday essentials with live inventory. What you see in stock is what we deliver — and you can change your order anytime.</p>
            <div class="foot-badges"><span>${icon('zap')}Live stock</span><span>${icon('truck')}Free delivery</span><span>${icon('shield')}Easy cancel</span></div>
          </div>
          <nav class="foot-cols" aria-label="Footer">
            <div><h4>Shop</h4><a href="#/shop">All products</a><a href="#/shop?sort=newest">New in</a><a href="#/shop?max=999&sort=price_asc">Under ₹999</a><a href="#/shop?avail=in">In stock now</a></div>
            <div><h4>Account</h4><a href="#/orders">Orders</a><a href="#/saved">Saved items</a><a href="#/checkout">Checkout</a></div>
            <div><h4>Business</h4><a href="#/admin">Seller Hub</a><a href="#/admin/products">Products</a><a href="#/admin/inventory">Inventory</a><a href="#/admin/orders">Orders</a></div>
          </nav>
        </div>
        <div class="fine"><span>© ${new Date().getFullYear()} Lumen Store · Demo storefront</span><span class="fine-right">Prices in INR, inclusive of taxes ${themeToggleHtml('ftr')}</span></div>
      </div>
    </footer>
    <nav class="tabbar" aria-label="Quick navigation">
      <a href="#/" data-tab="home">${icon('home')}<span>Home</span></a>
      <a href="#/shop" data-tab="shop">${icon('grid')}<span>Shop</span></a>
      <a href="#/saved" data-tab="saved">${icon('heart')}<span>Saved</span><span class="count-dot" id="saved-count-m" hidden></span></a>
      <a href="#/orders" data-tab="orders">${icon('receipt')}<span>Orders</span></a>
      <a href="#/cart" data-tab="cart" role="button">${icon('bag')}<span>Cart</span><span class="count-dot" id="cart-count-m" hidden></span></a>
    </nav>`;

  const header = root.querySelector('#s-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  root.querySelector('#cart-btn').addEventListener('click', openCart);
  root.querySelector('[data-tab="cart"]').addEventListener('click', (e) => {
    e.preventDefault();
    openCart();
  });

  setupSearch(root);
  updateCounts(false);
  cart.subscribe(() => updateCounts(true));
  saved.subscribe(() => updateCounts(false));
}

export function setStoreNav(key) {
  document.querySelectorAll('.s-nav a, .tabbar a').forEach((a) => {
    const active = (a.dataset.nav || a.dataset.tab) === key;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function updateCounts(animate) {
  const n = cart.count();
  const el = document.getElementById('cart-count');
  if (el) {
    if (animate) countUp(el, n);
    else {
      el.textContent = n;
      el.dataset.value = n;
    }
  }
  const m = document.getElementById('cart-count-m');
  if (m) {
    m.textContent = n;
    m.hidden = n === 0;
  }
  const s = saved.count();
  ['saved-count', 'saved-count-m'].forEach((id) => {
    const dot = document.getElementById(id);
    if (dot) {
      dot.textContent = s;
      dot.hidden = s === 0;
    }
  });
}

// ------------------------------------------------------------------ search
function highlight(text, q) {
  const safe = esc(text);
  const words = q.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return safe;
  return safe.replace(new RegExp(`(${words.join('|')})`, 'ig'), '<mark>$1</mark>');
}

function setupSearch(root) {
  const wrap = root.querySelector('#s-search');
  const input = root.querySelector('#search-input');
  const pop = root.querySelector('#search-pop');
  let active = -1;
  let options = [];

  const close = () => {
    pop.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };

  const go = (opt) => {
    close();
    input.blur();
    const q = input.value.trim();
    if (opt.type !== 'all') {
      input.value = '';
      wrap.classList.remove('has-value');
    }
    if (opt.type === 'product') navigate(`#/product/${opt.id}`);
    else if (opt.type === 'category') navigate(`#/shop?cat=${opt.id}`);
    else navigate(`#/shop?q=${encodeURIComponent(q)}`);
  };

  const paint = () => {
    pop.querySelectorAll('[data-opt]').forEach((el, i) => {
      el.classList.toggle('active', i === active);
      el.setAttribute('aria-selected', i === active);
      if (i === active) el.scrollIntoView({ block: 'nearest' });
    });
  };

  const render = async () => {
    const q = input.value.trim();
    wrap.classList.toggle('has-value', !!q);
    if (!q) {
      close();
      return;
    }
    await loadCatalog().catch(() => null);
    const hits = searchProducts(q, 6);
    const cats = getCategories().filter((c) => c.type_name.toLowerCase().includes(q.toLowerCase())).slice(0, 3);
    options = [
      ...cats.map((c) => ({ type: 'category', id: c.id })),
      ...hits.map((p) => ({ type: 'product', id: p.id })),
      { type: 'all' },
    ];
    let html = '';
    if (cats.length) {
      html += '<div class="group">Categories</div>';
      html += cats
        .map((c, i) => `<div class="res" data-opt="${i}" role="option">${productThumb({ name: '', type_name: c.type_name }, 40)}<div class="meta"><b>${highlight(c.type_name, q)}</b><small>${c.count} products</small></div>${icon('chev-right')}</div>`)
        .join('');
    }
    if (hits.length) {
      html += '<div class="group">Products</div>';
      html += hits
        .map((p, i) => {
          const s = stockInfo(p);
          return `<div class="res" data-opt="${cats.length + i}" role="option">${productThumb(p, 44)}<div class="meta"><b>${highlight(p.name, q)}</b><small>${esc(p.type_name)} · ${esc(s.label)}</small></div><span class="price">${money(p.price)}</span></div>`;
        })
        .join('');
    }
    if (!cats.length && !hits.length) html += `<div class="none">No matches for “${esc(q)}”</div>`;
    html += `<div class="all" data-opt="${options.length - 1}" role="option">See all results for “${esc(q)}” ${icon('arrow-right')}</div>`;
    pop.innerHTML = html;
    active = -1;
    pop.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
    pop.querySelectorAll('[data-opt]').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        go(options[Number(el.dataset.opt)]);
      });
    });
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', () => input.value.trim() && render());
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (!pop.classList.contains('open')) {
      if (e.key === 'Enter' && input.value.trim()) go({ type: 'all' });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % options.length;
      paint();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + options.length) % options.length;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active >= 0 ? options[active] : { type: 'all' });
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });

  // "/" focuses search from anywhere (except while typing in a field)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (!document.getElementById('search-input')) return;
    e.preventDefault();
    input.focus();
  });
}

// ------------------------------------------------------------------ cart drawer
let cartPanel = null;
let unsubscribe = null;

export function openCart() {
  if (cartPanel) return;
  cartPanel = openOverlay(
    `<div class="drawer-head">
        <h2 id="cart-title">${icon('bag')}Your cart</h2>
        <button class="icon-btn" data-close aria-label="Close cart">${icon('x')}</button>
      </div>
      <div class="drawer-body" id="cart-body"></div>
      <div class="drawer-foot" id="cart-foot"></div>`,
    {
      variant: 'right',
      label: 'Shopping cart',
      onClose: () => {
        cartPanel = null;
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
      },
    }
  );
  renderCartBody();
  unsubscribe = cart.subscribe(renderCartBody);
  loadCatalog().then(renderCartBody).catch(() => {});
}

export function closeCart() {
  if (cartPanel) cartPanel.close();
}

export function cartTotals() {
  const lines = cart
    .lines()
    .map((l) => ({ ...l, p: getProduct(l.id) }))
    .filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.p.price, 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  return { lines, subtotal, units };
}

function renderCartBody() {
  const body = document.getElementById('cart-body');
  const foot = document.getElementById('cart-foot');
  if (!body) return;
  const { lines, subtotal, units } = cartTotals();
  const title = document.getElementById('cart-title');
  title.innerHTML = `${icon('bag')}Your cart${units ? ` <span class="badge plain">${units} item${units === 1 ? '' : 's'}</span>` : ''}`;

  if (!lines.length) {
    body.innerHTML = `
      <div class="empty" style="padding-top:72px">
        ${icon('bag')}
        <h3>Your cart is empty</h3>
        <p>Find something you love — stock is live, so grab it while it’s here.</p>
        <a class="btn primary" href="#/shop" data-close-link>Start shopping</a>
      </div>`;
    foot.innerHTML = '';
    body.querySelector('[data-close-link]').addEventListener('click', closeCart);
    return;
  }

  body.innerHTML = lines
    .map(({ p, qty }) => {
      const low = p.stock_available <= 5;
      return `
      <div class="cline">
        <a href="#/product/${p.id}" data-close-link>${productThumb(p, 76)}</a>
        <div class="info">
          <b>${esc(p.name)}</b>
          <small>${esc(p.type_name)} · ${money(p.price)} each</small>
          ${low ? `<span class="warn">Only ${p.stock_available} left</span>` : ''}
        </div>
        <div class="right">
          <b class="tabular">${money(p.price * qty)}</b>
          ${cartControl(p)}
        </div>
      </div>`;
    })
    .join('');
  body.querySelectorAll('[data-close-link]').forEach((a) => a.addEventListener('click', closeCart));

  foot.innerHTML = `
    <div class="sum-row"><span>Subtotal (${units} item${units === 1 ? '' : 's'})</span><b>${money(subtotal)}</b></div>
    <div class="sum-row"><span>Delivery</span><b style="color:var(--green)">Free</b></div>
    <div class="sum-row total"><span>Total</span><b>${money(subtotal)}</b></div>
    <a class="btn primary xl block" href="#/checkout" id="go-checkout" style="margin-top:14px">Checkout ${icon('arrow-right')}</a>
    <button class="btn ghost block" data-close style="margin-top:6px">Continue shopping</button>`;
  foot.querySelector('#go-checkout').addEventListener('click', closeCart);
  foot.querySelector('[data-close]').addEventListener('click', closeCart);
}

