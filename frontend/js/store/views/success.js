import { api } from '../../api.js';
import { esc, fmtDate, icon, money } from '../../ui.js';
import { productThumb } from '../art.js';
import { loadCatalog } from '../catalog.js';
import { confetti } from '../motion.js';

export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="order-success"><div class="skeleton" style="width:112px;height:112px;border-radius:50%;margin:0 auto"></div></div></div>`;
  const { data: o } = await api.purchases.get(params.id);
  loadCatalog({ force: true }).catch(() => {});
  if (!ctx.isCurrent()) return;

  view.innerHTML = `
    <div class="container">
      <div class="order-success">
        <svg class="check" viewBox="0 0 112 112" aria-hidden="true">
          <circle class="fill" cx="56" cy="56" r="50" fill="var(--green-soft)"/>
          <circle cx="56" cy="56" r="50" fill="none" stroke="var(--green)" stroke-width="5" stroke-linecap="round" transform="rotate(-90 56 56)"/>
          <path d="M36 58l13 13 27-29" fill="none" stroke="var(--green)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h1>Order placed!</h1>
        <p>Thank you. Your items are reserved and stock has been updated.</p>
        <div class="oid">${icon('receipt')}<span class="order-id">${esc(o.order_id)}</span><span class="muted">· ${fmtDate(o.purchase_date)}</span></div>
        <section class="panel receipt">
          <div class="panel-body">
            ${o.items
              .map(
                (l) => `<div class="oline">${productThumb({ name: l.item_name, type_name: l.type_name }, 64)}
                  <div><b>${esc(l.item_name)}</b><div class="muted" style="font-size:.85rem">${esc(l.type_name)}</div></div>
                  <span class="q">${l.quantity} × ${money(l.unit_price)}</span><span class="t">${money(l.line_total)}</span></div>`
              )
              .join('')}
            <div class="sum-row total"><span>Total · pay on delivery</span><b>${money(o.total_amount)}</b></div>
          </div>
        </section>
        <div class="actions-row">
          <a class="btn primary lg" href="#/orders/${o.id}">${icon('receipt')}View order</a>
          <a class="btn outline lg" href="#/shop">Continue shopping</a>
        </div>
        <p style="font-size:.88rem;margin-top:18px">Need a change? You can modify or cancel this order from <a href="#/orders/${o.id}" style="color:var(--brand);font-weight:600">your orders</a>.</p>
      </div>
    </div>`;
  setTimeout(confetti, 450);
}
