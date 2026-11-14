import { api } from '../../api.js';
import { productThumb } from '../../store/art.js';
import {
  availabilityBadge, emptyState, esc, fmtDate, fmtNum, icon, money, pageHead, purchaseStatusBadge, skeletonRows,
} from '../../ui.js';

function head() {
  return pageHead({
    title: 'Dashboard',
    subtitle: 'Sales, stock health and the latest orders at a glance.',
    actions: `<a class="btn" href="#/admin/products/new">${icon('plus')}Add product</a>
              <a class="btn primary" href="#/admin/orders/new">${icon('receipt')}New order</a>`,
  });
}

export async function render(view, params, ctx) {
  view.innerHTML = head() + `<div class="card">${skeletonRows(6)}</div>`;
  const { data } = await api.dashboard();
  if (!ctx.isCurrent()) return;
  const c = data.counts;

  const attention = data.attention.length
    ? `<ul class="list">${data.attention
        .map(
          (i) => `
        <li>
          <a class="lead" href="#/admin/products/${i.id}">${productThumb(i, 40)}
            <span><span class="primary-text">${esc(i.name)}</span><br><span class="secondary-text">${esc(i.type_name)}${i.active ? '' : ' · Inactive'}</span></span>
          </a>
          <div class="actions"><strong class="tabular">${fmtNum(i.stock_available)}</strong>${availabilityBadge(i.availability)}</div>
        </li>`
        )
        .join('')}</ul>`
    : emptyState({ iconName: 'check-circle', title: 'All products are well stocked', text: `Nothing is at or below ${data.low_stock_threshold} units.` });

  const recent = data.recent_purchases.length
    ? `<ul class="list">${data.recent_purchases
        .map(
          (p) => `
        <li>
          <a class="lead" href="#/admin/orders/${p.id}">
            <span><span class="primary-text order-id">${esc(p.order_id)}</span><br>
            <span class="secondary-text">${fmtDate(p.purchase_date)} · ${p.line_count} product${p.line_count === 1 ? '' : 's'} · ${fmtNum(p.total_quantity)} units</span></span>
          </a>
          <div class="actions"><strong class="tabular">${money(p.total_amount)}</strong>${purchaseStatusBadge(p.status)}</div>
        </li>`
        )
        .join('')}</ul>`
    : emptyState({ iconName: 'cart', title: 'No orders yet', text: 'Orders placed in the store appear here instantly.', action: `<a class="btn primary" href="#/">${icon('store')}Open storefront</a>` });

  const best = (data.best_sellers || []).length
    ? `<ul class="list">${data.best_sellers
        .map(
          (b, i) => `<li><a class="lead" href="#/admin/products/${b.id}"><strong class="tabular" style="width:18px;color:var(--ink-3)">${i + 1}</strong>${productThumb(b, 40)}
            <span><span class="primary-text">${esc(b.name)}</span><br><span class="secondary-text">${fmtNum(b.units)} sold · ${fmtNum(b.stock_available)} left</span></span></a>
            <strong class="tabular">${money(b.revenue)}</strong></li>`
        )
        .join('')}</ul>`
    : emptyState({ iconName: 'trend', title: 'No sales yet', text: 'Best sellers show up after the first order.' });

  view.innerHTML =
    head() +
    `
    <section class="stats" aria-label="Summary">
      <a class="stat feature" href="#/admin/orders">
        <span class="label">${icon('trend')}Revenue</span>
        <span class="value">${money(c.revenue)}</span>
        <span class="sub">${fmtNum(c.units_sold)} units · ${fmtNum(c.completed_purchases)} confirmed orders</span>
      </a>
      <a class="stat" href="#/admin/orders">
        <span class="label">${icon('receipt')}Orders</span>
        <span class="value">${fmtNum(c.purchases)}</span>
        <span class="sub">${fmtNum(c.cancelled_purchases)} cancelled</span>
      </a>
      <a class="stat" href="#/admin/products">
        <span class="label">${icon('box')}Products</span>
        <span class="value">${fmtNum(c.total_items)}</span>
        <span class="sub">${fmtNum(c.active_items)} active · ${fmtNum(c.inactive_items)} inactive</span>
      </a>
      <a class="stat" href="#/admin/inventory">
        <span class="label">${icon('package')}Inventory value</span>
        <span class="value">${money(c.inventory_value)}</span>
        <span class="sub">${fmtNum(c.total_units)} units on hand</span>
      </a>
    </section>
    <section class="stats" aria-label="Stock health">
      <a class="stat green" href="#/admin/inventory?f=in"><span class="label">In stock</span><span class="value">${fmtNum(c.in_stock)}</span><span class="sub">more than ${data.low_stock_threshold} units</span></a>
      <a class="stat orange" href="#/admin/inventory?f=low"><span class="label">Low stock</span><span class="value">${fmtNum(c.low_stock)}</span><span class="sub">1 – ${data.low_stock_threshold} units</span></a>
      <a class="stat red" href="#/admin/inventory?f=out"><span class="label">Out of stock</span><span class="value">${fmtNum(c.out_of_stock)}</span><span class="sub">0 units</span></a>
      <a class="stat" href="#/admin/categories"><span class="label">${icon('tag')}Categories</span><span class="value">${fmtNum(c.item_types)}</span><span class="sub">item types</span></a>
    </section>

    <div class="grid cols-3">
      <section class="card">
        <div class="card-head"><h2>Recent orders</h2><a class="btn ghost sm" href="#/admin/orders">View all</a></div>
        ${recent}
      </section>
      <section class="card">
        <div class="card-head"><h2>Best sellers</h2><span class="hint">by units</span></div>
        ${best}
      </section>
      <section class="card">
        <div class="card-head"><h2>Needs restocking</h2><a class="btn ghost sm" href="#/admin/inventory">Inventory</a></div>
        ${attention}
      </section>
    </div>`;
}
