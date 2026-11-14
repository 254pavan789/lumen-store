import { api } from '../../api.js';
import { debounce, esc, fmtDate, icon, money } from '../../ui.js';
import { productThumb } from '../art.js';
import { getProduct, loadCatalog } from '../catalog.js';
import { staggerIn } from '../motion.js';

export function orderStatusBadge(status) {
  return status === 'CANCELLED' ? '<span class="badge red">Cancelled</span>' : '<span class="badge green">Confirmed</span>';
}

/** Thumbnail stack for an order using the catalogue (falls back to names from the summary) */
export function orderThumbs(o, max = 3) {
  const names = String(o.items_summary || '').split('; ').map((s) => s.replace(/ – \d+$/, ''));
  const ids = o.item_ids || [];
  const thumbs = ids.slice(0, max).map((id, i) => productThumb(getProduct(id) || { name: names[i] || '', type_name: '' }, 56));
  const more = ids.length > max ? `<span class="more">+${ids.length - max}</span>` : '';
  return `<div class="tstack">${thumbs.join('')}${more}</div>`;
}

export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="skeleton" style="height:56px;width:30%;margin-top:28px"></div>
    ${'<div class="skeleton" style="height:96px;border-radius:22px;margin-top:14px"></div>'.repeat(4)}</div>`;
  const [{ data: orders }] = await Promise.all([api.purchases.list({}), loadCatalog().catch(() => null)]);
  if (!ctx.isCurrent()) return;

  const state = { tab: 'all', q: '' };
  const counts = {
    all: orders.length,
    COMPLETED: orders.filter((o) => o.status === 'COMPLETED').length,
    CANCELLED: orders.filter((o) => o.status === 'CANCELLED').length,
  };

  view.innerHTML = `
    <div class="container">
      <div class="page-title">
        <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<span>Orders</span></div>
        <h1>Your orders</h1>
        <p>Track, modify or cancel your purchases. Every order stays in your history.</p>
      </div>
      <div class="results-bar" style="margin-top:20px">
        <div class="tabs" role="tablist">
          <button class="active" data-tab="all" role="tab">All<span class="c">${counts.all}</span></button>
          <button data-tab="COMPLETED" role="tab">Confirmed<span class="c">${counts.COMPLETED}</span></button>
          <button data-tab="CANCELLED" role="tab">Cancelled<span class="c">${counts.CANCELLED}</span></button>
        </div>
        <div class="s-search" style="max-width:320px;margin:0;flex:1">${icon('search')}<input class="input" id="o-search" type="search" placeholder="Search order ID or product" aria-label="Search orders" style="height:42px"/></div>
      </div>
      <div id="o-list"></div>
    </div>`;

  const list = view.querySelector('#o-list');
  const draw = (animate) => {
    const q = state.q.toLowerCase();
    const rows = orders.filter(
      (o) => (state.tab === 'all' || o.status === state.tab) && (!q || o.order_id.toLowerCase().includes(q) || String(o.items_summary).toLowerCase().includes(q))
    );
    if (!orders.length) {
      list.innerHTML = `<div class="empty">${icon('receipt')}<h3>No orders yet</h3><p>When you place an order it will show up here.</p><a class="btn primary" href="#/shop">Start shopping</a></div>`;
      return;
    }
    if (!rows.length) {
      list.innerHTML = `<div class="empty">${icon('search')}<h3>No matching orders</h3><p>Try a different search or tab.</p></div>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (o) => `
      <a class="ocard" href="#/orders/${o.id}">
        ${orderThumbs(o)}
        <div class="info">
          <div class="top"><span class="order-id">${esc(o.order_id)}</span>${orderStatusBadge(o.status)}<span class="muted" style="font-size:.85rem">${fmtDate(o.purchase_date)}</span></div>
          <div class="names">${esc(o.items_summary || '')}</div>
        </div>
        <div class="amt"><b>${money(o.total_amount)}</b><small>${o.total_quantity} item${o.total_quantity === 1 ? '' : 's'}</small></div>
      </a>`
      )
      .join('');
    if (animate) staggerIn(list, ':scope > *', 30, 10);
  };

  view.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      view.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
      draw(true);
    })
  );
  view.querySelector('#o-search').addEventListener(
    'input',
    debounce((e) => {
      state.q = e.target.value.trim();
      draw(false);
    }, 150)
  );
  draw(true);
}
