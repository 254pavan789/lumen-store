/**
 * App entry: hash router with two layouts
 *   - Storefront  (#/, #/shop, #/product/:id, #/checkout, #/orders ...)
 *   - Seller Hub  (#/admin/...)  item master, categories, inventory, orders
 */
import { api } from './api.js';
import { isCurrent, nextRenderToken } from './state.js';
import { errorState, icon, logoMark } from './ui.js';
import { initTheme, themeToggleHtml } from './theme.js';

import { bindStoreActions } from './store/components.js';
import { openCart, renderStoreShell, setStoreNav } from './store/shell.js';
import { closeOverlay } from './store/overlay.js';
import { runSplash, shouldShowSplash } from './store/splash.js';
import * as home from './store/views/home.js';
import * as shop from './store/views/shop.js';
import * as product from './store/views/product.js';
import * as checkout from './store/views/checkout.js';
import * as success from './store/views/success.js';
import * as orders from './store/views/orders.js';
import * as orderDetail from './store/views/orderDetail.js';
import * as orderEdit from './store/views/orderEdit.js';
import * as savedView from './store/views/saved.js';

import * as dashboard from './admin/views/dashboard.js';
import * as itemTypes from './admin/views/itemTypes.js';
import * as items from './admin/views/items.js';
import * as itemForm from './admin/views/itemForm.js';
import * as itemDetails from './admin/views/itemDetails.js';
import * as purchases from './admin/views/purchases.js';
import * as purchaseForm from './admin/views/purchaseForm.js';
import * as purchaseDetails from './admin/views/purchaseDetails.js';
import * as stock from './admin/views/stock.js';

const S = 'store';
const A = 'admin';

const ROUTES = [
  // storefront
  { re: /^\/?$/, view: home, layout: S, nav: 'home', title: 'Lumen — Everyday essentials, live inventory' },
  { re: /^\/cart$/, view: home, layout: S, nav: 'home', title: 'Cart', after: openCart },
  { re: /^\/shop$/, view: shop, layout: S, nav: 'shop', title: 'Shop' },
  { re: /^\/product\/(\d+)$/, view: product, layout: S, nav: 'shop', page: 'product', title: 'Product', params: (m) => ({ id: m[1] }) },
  { re: /^\/checkout$/, view: checkout, layout: S, nav: '', page: 'checkout', title: 'Checkout' },
  { re: /^\/order-placed\/(\d+)$/, view: success, layout: S, nav: 'orders', title: 'Order placed', params: (m) => ({ id: m[1] }) },
  { re: /^\/orders$/, view: orders, layout: S, nav: 'orders', title: 'Your orders' },
  { re: /^\/orders\/(\d+)$/, view: orderDetail, layout: S, nav: 'orders', title: 'Order details', params: (m) => ({ id: m[1] }) },
  { re: /^\/orders\/(\d+)\/edit$/, view: orderEdit, layout: S, nav: 'orders', title: 'Modify order', params: (m) => ({ id: m[1] }) },
  { re: /^\/saved$/, view: savedView, layout: S, nav: 'saved', title: 'Saved' },

  // seller hub
  { re: /^\/admin\/?$/, view: dashboard, layout: A, nav: 'dashboard', title: 'Dashboard' },
  { re: /^\/admin\/products$/, view: items, layout: A, nav: 'products', title: 'Products' },
  { re: /^\/admin\/products\/new$/, view: itemForm, layout: A, nav: 'products', title: 'Add product', params: () => ({ mode: 'create' }) },
  { re: /^\/admin\/products\/(\d+)\/edit$/, view: itemForm, layout: A, nav: 'products', title: 'Edit product', params: (m) => ({ mode: 'edit', id: m[1] }) },
  { re: /^\/admin\/products\/(\d+)$/, view: itemDetails, layout: A, nav: 'products', title: 'Product details', params: (m) => ({ id: m[1] }) },
  { re: /^\/admin\/categories$/, view: itemTypes, layout: A, nav: 'categories', title: 'Categories' },
  { re: /^\/admin\/inventory$/, view: stock, layout: A, nav: 'inventory', title: 'Inventory' },
  { re: /^\/admin\/orders$/, view: purchases, layout: A, nav: 'orders', title: 'Orders' },
  { re: /^\/admin\/orders\/new$/, view: purchaseForm, layout: A, nav: 'orders', title: 'New order', params: () => ({ mode: 'create' }) },
  { re: /^\/admin\/orders\/([^/]+)\/edit$/, view: purchaseForm, layout: A, nav: 'orders', title: 'Update order', params: (m) => ({ mode: 'edit', id: decodeURIComponent(m[1]) }) },
  { re: /^\/admin\/orders\/([^/]+)$/, view: purchaseDetails, layout: A, nav: 'orders', title: 'Order details', params: (m) => ({ id: decodeURIComponent(m[1]) }) },
];

// legacy (v1) URLs keep working
const LEGACY = [
  [/^\/items(\/.*)?$/, (m) => `/admin/products${m[1] || ''}`],
  [/^\/item-types$/, () => '/admin/categories'],
  [/^\/stock$/, () => '/admin/inventory'],
  [/^\/purchases(\/.*)?$/, (m) => `/admin/orders${m[1] || ''}`],
];

const root = document.getElementById('app');
let currentLayout = null;

const HUB_TABS = [
  { key: 'dashboard', href: '#/admin', icon: 'grid', label: 'Dashboard' },
  { key: 'products', href: '#/admin/products', icon: 'box', label: 'Products' },
  { key: 'orders', href: '#/admin/orders', icon: 'receipt', label: 'Orders' },
  { key: 'inventory', href: '#/admin/inventory', icon: 'bars', label: 'Inventory' },
];

function renderAdminShell() {
  root.innerHTML = `
    <div class="hub">
      <aside class="hub-side" aria-label="Seller Hub navigation">
        <a class="hub-brand" href="#/admin">${logoMark('mark', 'hub')}<span><b>Lumen</b><small>Seller Hub</small></span></a>
        <nav class="hub-nav" id="hub-nav">
          <span class="sec">Overview</span>
          <a href="#/admin" data-nav="dashboard">${icon('grid')}<span>Dashboard</span></a>
          <span class="sec">Catalogue</span>
          <a href="#/admin/products" data-nav="products">${icon('box')}<span>Products</span></a>
          <a href="#/admin/categories" data-nav="categories">${icon('tag')}<span>Categories</span></a>
          <a href="#/admin/inventory" data-nav="inventory">${icon('bars')}<span>Inventory</span></a>
          <span class="sec">Sales</span>
          <a href="#/admin/orders" data-nav="orders">${icon('receipt')}<span>Orders</span></a>
          <a href="#/admin/orders/new" data-nav="order-new">${icon('plus-circle')}<span>New order</span></a>
        </nav>
        <div class="hub-foot">
          <div class="hub-theme"><span>Appearance</span>${themeToggleHtml('hub')}</div>
          <a class="to-store" href="#/">${icon('store')}<span>Open storefront</span></a>
          <div class="engine-status" id="engine-status"><span class="dot"></span><span class="label">Connecting…</span></div>
        </div>
      </aside>
      <header class="hub-top" id="hub-top">
        <a class="hub-top-brand" href="#/admin" aria-label="Seller Hub home">${logoMark('mark', 'hubm')}</a>
        <div class="hub-top-title"><b class="t-hub">Seller Hub</b><b class="t-page" id="hub-title">Dashboard</b></div>
        ${themeToggleHtml('hubm')}
        <a class="icon-btn" href="#/" aria-label="Open storefront">${icon('store')}</a>
      </header>
      <main class="hub-main"><div id="view" class="hub-view" tabindex="-1"></div></main>
      <nav class="hub-tabbar" aria-label="Seller Hub">
        ${HUB_TABS.map((t) => `<a href="${t.href}" data-tab="${t.key}">${icon(t.icon)}<span>${t.label}</span></a>`).join('')}
        <button type="button" data-tab="more" id="hub-more" aria-haspopup="dialog">${icon('sliders')}<span>More</span></button>
      </nav>
    </div>`;
  root.querySelector('#hub-more').addEventListener('click', openHubMore);
  const onScroll = () => {
    const top = document.getElementById('hub-top');
    if (top) top.classList.toggle('scrolled', window.scrollY > 4);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  checkHealth();
}

function openHubMore() {
  import('./store/overlay.js').then(({ openOverlay }) => {
    openOverlay(
      `<div class="drawer-head"><h2>${icon('sliders')}More</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
       <div class="drawer-body more-menu">
         <a href="#/admin/categories" data-close>${icon('tag')}<span><b>Categories</b><small>Item types</small></span>${icon('chev-right')}</a>
         <a href="#/admin/orders/new" data-close>${icon('plus-circle')}<span><b>New order</b><small>Create a purchase manually</small></span>${icon('chev-right')}</a>
         <a href="#/admin/products/new" data-close>${icon('plus')}<span><b>Add product</b><small>New item in the catalogue</small></span>${icon('chev-right')}</a>
         <a href="#/" data-close>${icon('store')}<span><b>Open storefront</b><small>See the store as shoppers do</small></span>${icon('chev-right')}</a>
         <div class="more-row"><span><b>Appearance</b><small>Light or dark</small></span>${themeToggleHtml('more')}</div>
         <div class="engine-status" id="engine-status-m"><span class="dot"></span><span class="label">Checking…</span></div>
       </div>`,
      { variant: 'left', label: 'More' }
    );
    checkHealth('engine-status-m');
  });
}

/** Phones: every table becomes a stack of cards; labels come from the header row. */
function labelTables(scope) {
  scope.querySelectorAll('table.table').forEach((table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.classList.add('stackable');
    table.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
      let col = 0;
      [...tr.children].forEach((td) => {
        if (!td.dataset.label && heads[col]) td.dataset.label = heads[col];
        col += Number(td.getAttribute('colspan') || 1);
      });
    });
  });
}

let tableObserver = null;
function watchTables(view) {
  if (tableObserver) tableObserver.disconnect();
  labelTables(view);
  tableObserver = new MutationObserver(() => labelTables(view));
  tableObserver.observe(view, { childList: true, subtree: true });
}

function ensureLayout(layout) {
  if (currentLayout === layout) return;
  currentLayout = layout;
  if (layout === S) renderStoreShell(root);
  else renderAdminShell();
}

function setAdminNav(key) {
  document.querySelectorAll('#hub-nav a, .hub-tabbar [data-tab]').forEach((a) => {
    const k = a.dataset.nav || a.dataset.tab;
    const active = k === key || (a.dataset.tab === 'more' && ['categories', 'order-new'].includes(key));
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/** Fresh #view element per navigation: drops listeners from the previous page. */
function freshView() {
  const old = document.getElementById('view');
  const view = old.cloneNode(false);
  view.classList.remove('view-enter');
  old.replaceWith(view);
  void view.offsetWidth;
  view.classList.add('view-enter');
  return view;
}

async function router() {
  let path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  for (const [re, to] of LEGACY) {
    const m = path.match(re);
    if (m) {
      location.replace(`#${to(m)}`);
      return;
    }
  }

  const route = ROUTES.find((r) => r.re.test(path));
  const token = nextRenderToken();
  closeOverlay();
  ensureLayout(route ? route.layout : S);
  const view = freshView();

  if (!route) {
    document.title = 'Page not found · Lumen';
    view.innerHTML = `<div class="container"><div class="empty" style="padding-top:96px">${icon('search')}<h3>Page not found</h3>
      <p>The page you’re looking for doesn’t exist.</p><a class="btn primary" href="#/">Go home</a></div></div>`;
    return;
  }

  document.body.dataset.page = route.page || route.nav || '';
  document.body.dataset.layout = route.layout;
  if (route.layout === S) setStoreNav(route.nav);
  else {
    setAdminNav(route.nav);
    const t = document.getElementById('hub-title');
    if (t) t.textContent = route.title;
    watchTables(view);
  }
  document.title = route.layout === A ? `${route.title} · Lumen Seller Hub` : route.title.includes('Lumen') ? route.title : `${route.title} · Lumen`;
  if (!location.hash.includes('#categories')) window.scrollTo({ top: 0 });

  const params = route.params ? route.params(path.match(route.re)) : {};
  try {
    await route.view.render(view, params, { isCurrent: () => isCurrent(token) });
    if (route.after && isCurrent(token)) route.after();
  } catch (error) {
    if (isCurrent(token)) view.innerHTML = route.layout === S ? `<div class="container" style="padding-top:28px">${errorState(error)}</div>` : errorState(error);
    console.error(error);
  }
}

async function checkHealth(id = 'engine-status') {
  const el = document.getElementById(id);
  if (!el) return;
  const label = el.querySelector('.label');
  try {
    const { data } = await api.health();
    el.className = 'engine-status ok';
    label.textContent = `Python engine · ${data.database}`;
    el.title = `Python ${data.python} · MySQL ${data.mysql_version}`;
  } catch (error) {
    el.className = 'engine-status bad';
    label.textContent = error.status === 503 ? 'Database offline' : 'Backend offline';
    el.title = error.message;
  }
}

// in-page anchor (#categories) on the home page
window.addEventListener('click', (e) => {
  const a = e.target.closest('a[href="#categories"]');
  if (!a) return;
  e.preventDefault();
  const target = document.getElementById('categories');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function start() {
  initTheme();
  bindStoreActions();
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const isStore = !path.startsWith('/admin');
  if (isStore && shouldShowSplash()) {
    const splashDone = runSplash();
    window.addEventListener('hashchange', router);
    await router(); // render underneath while the splash plays
    await splashDone;
    // replay the page entrance as the splash lifts away
    document.querySelectorAll('.enter-stagger').forEach((el) => {
      el.classList.remove('enter-stagger');
      void el.offsetWidth;
      el.classList.add('enter-stagger');
    });
  } else {
    window.addEventListener('hashchange', router);
    router();
  }
  setInterval(checkHealth, 30000);
}

start();
