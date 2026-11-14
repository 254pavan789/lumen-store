import { api } from '../../api.js';
import { flash, navigate } from '../../state.js';
import { confirmDialog, esc, fmtDate, fmtDateTime, icon, money, toast, toastError } from '../../ui.js';
import { productThumb } from '../art.js';
import { cart } from '../cart.js';
import { getProduct, invalidateCatalog, loadCatalog } from '../catalog.js';
import { openCart } from '../shell.js';
import { orderStatusBadge } from './orders.js';

export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="skeleton" style="height:56px;width:40%;margin-top:28px"></div>
    <div class="checkout"><div class="skeleton" style="height:420px;border-radius:24px"></div><div class="skeleton" style="height:280px;border-radius:24px"></div></div></div>`;
  const [{ data: o }] = await Promise.all([api.purchases.get(params.id), loadCatalog().catch(() => null)]);
  if (!ctx.isCurrent()) return;

  const changes = flash.purchaseAdjustments;
  flash.purchaseAdjustments = null;
  const changed = (changes || []).filter((a) => a.stock_change !== 0);
  const updated = o.updated_at && o.created_at && o.updated_at !== o.created_at;
  const cancelled = o.status === 'CANCELLED';

  const steps = [
    { label: 'Order placed', sub: fmtDateTime(o.created_at), state: 'done', ico: 'check' },
    { label: 'Stock reserved', sub: `${o.total_quantity} units`, state: 'done', ico: 'package' },
    cancelled
      ? { label: 'Cancelled', sub: fmtDateTime(o.cancelled_at), state: 'cancel', ico: 'x' }
      : { label: updated ? 'Order updated' : 'Ready to ship', sub: updated ? fmtDateTime(o.updated_at) : 'Pay on delivery', state: updated ? 'done' : '', ico: updated ? 'edit' : 'truck' },
  ];

  view.innerHTML = `
    <div class="container">
      <div class="page-title">
        <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<a href="#/orders">Orders</a>${icon('chev-right')}<span>${esc(o.order_id)}</span></div>
        <h1 style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="order-id" style="font-weight:700">${esc(o.order_id)}</span>${orderStatusBadge(o.status)}</h1>
        <p>Ordered on ${fmtDate(o.purchase_date)} · ${o.line_count} product${o.line_count === 1 ? '' : 's'}</p>
      </div>
      ${
        changed.length
          ? `<div class="notice success" style="margin-top:18px">${icon('check-circle')}<div><strong>Changes saved — stock adjusted by the difference</strong><ul>${changed
              .map((a) => `<li>${esc(a.item_name)}: ${a.old_quantity} → ${a.new_quantity} (${a.stock_change > 0 ? `${a.stock_change} returned to stock` : `${-a.stock_change} more reserved`})</li>`)
              .join('')}</ul></div></div>`
          : ''
      }
      ${
        cancelled
          ? `<div class="notice warn" style="margin-top:18px">${icon('ban')}<div><strong>This order was cancelled.</strong> All items were returned to stock.${o.cancel_reason ? ` Reason: ${esc(o.cancel_reason)}` : ''}</div></div>`
          : ''
      }
      <div class="checkout">
        <div>
          <section class="panel">
            <div class="timeline">
              ${steps.map((s) => `<div class="tl-step ${s.state}"><span class="dot">${icon(s.ico)}</span><b>${s.label}</b><small>${esc(s.sub)}</small></div>`).join('')}
            </div>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Items</h2><span class="hint">${o.total_quantity} units</span></div>
            <div class="panel-body">
              ${o.items
                .map((l) => {
                  const live = getProduct(l.item_id);
                  return `<div class="oline">
                    <a href="#/product/${l.item_id}">${productThumb({ name: l.item_name, type_name: l.type_name }, 64)}</a>
                    <div style="min-width:0">
                      <a href="#/product/${l.item_id}"><b>${esc(l.item_name)}</b></a>
                      <div class="muted" style="font-size:.84rem">${esc(l.type_name)} · ${
                        !l.item_active ? '<span style="color:var(--red)">No longer sold</span>' : live && live.stock_available > 0 ? `${live.stock_available} in stock` : 'Sold out'
                      }</div>
                    </div>
                    <span class="q">${l.quantity} × ${money(l.unit_price)}</span>
                    <span class="t">${money(l.line_total)}</span>
                  </div>`;
                })
                .join('')}
            </div>
          </section>
        </div>
        <aside class="summary">
          <section class="panel">
            <div class="panel-head"><h2>Summary</h2></div>
            <div class="panel-body">
              <div class="sum-row"><span>Items (${o.total_quantity})</span><b>${money(o.total_amount)}</b></div>
              <div class="sum-row"><span>Delivery</span><b style="color:var(--green)">Free</b></div>
              <div class="sum-row"><span>Payment</span><b>On delivery</b></div>
              ${o.remarks ? `<div class="sum-row"><span>Note</span><b style="font-weight:500;text-align:right">${esc(o.remarks)}</b></div>` : ''}
              <div class="sum-row total"><span>Total</span><b>${money(o.total_amount)}</b></div>
              <div style="display:grid;gap:8px;margin-top:18px">
                ${
                  cancelled
                    ? ''
                    : `<a class="btn primary lg block" href="#/orders/${o.id}/edit">${icon('edit')}Modify order</a>`
                }
                <button class="btn outline lg block" id="again">${icon('repeat')}Buy again</button>
                ${cancelled ? '' : `<button class="btn ghost block" id="cancel" style="color:var(--red)">${icon('ban')}Cancel order</button>`}
              </div>
              <div class="secure">${icon('lock')}Orders are never deleted — they stay in your history</div>
            </div>
          </section>
        </aside>
      </div>
    </div>`;

  view.querySelector('#again').addEventListener('click', async () => {
    await loadCatalog({ force: true }).catch(() => {});
    let added = 0;
    const skipped = [];
    o.items.forEach((l) => {
      const p = getProduct(l.item_id);
      if (!p || p.stock_available <= 0) {
        skipped.push(l.item_name);
        return;
      }
      const before = cart.qty(p.id);
      added += cart.add(p.id, l.quantity, p.stock_available) - before;
    });
    if (added) openCart();
    toast(added ? `Added ${added} item${added === 1 ? '' : 's'} to your cart` : 'These items are currently unavailable', added ? 'success' : 'error', {
      list: skipped.length ? [`Unavailable: ${skipped.join(', ')}`] : [],
    });
  });

  const cancelBtn = view.querySelector('#cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const res = await confirmDialog({
        title: `Cancel ${o.order_id}?`,
        message: 'All items go back to stock. The order stays in your history marked as cancelled and can’t be modified afterwards.',
        confirmText: 'Cancel order',
        cancelText: 'Keep order',
        tone: 'danger',
        iconName: 'ban',
        input: { label: 'Reason (optional)', placeholder: 'e.g. Ordered by mistake', maxLength: 255 },
      });
      if (!res) return;
      try {
        const r = await api.purchases.cancel(o.id, res.value);
        invalidateCatalog();
        toast(r.message);
        navigate(`#/orders/${o.id}`);
      } catch (error) {
        toastError(error);
      }
    });
  }
}

