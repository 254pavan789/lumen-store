import { api } from '../../api.js';
import { flash, navigate } from '../../state.js';
import {
  availabilityBadge, confirmDialog, esc, fmtDate, fmtDateTime, fmtNum, icon, money, pageHead, purchaseStatusBadge, signed,
  skeletonRows, statusBadge, toast, toastError,
} from '../../ui.js';

export async function render(view, params, ctx) {
  view.innerHTML =
    pageHead({ title: 'Order Details', crumbs: [{ label: 'Orders', href: '#/admin/orders' }, { label: params.id }] }) +
    `<div class="card">${skeletonRows(6)}</div>`;

  const { data: p } = await api.purchases.get(params.id);
  if (!ctx.isCurrent()) return;

  const adjustments = flash.purchaseAdjustments;
  flash.purchaseAdjustments = null;
  const changed = (adjustments || []).filter((a) => a.stock_change !== 0 || a.action !== 'unchanged');

  const actions =
    p.status === 'COMPLETED'
      ? `<a class="btn primary" href="#/admin/orders/${p.id}/edit">${icon('edit')}Update order</a>
         <button class="btn" id="btn-cancel">${icon('ban')}Cancel Order</button>`
      : '';

  view.innerHTML =
    pageHead({
      title: `<span class="order-id">${esc(p.order_id)}</span> ${purchaseStatusBadge(p.status)}`,
      subtitle: `Purchase dated ${fmtDate(p.purchase_date)} · ${p.line_count} item${p.line_count === 1 ? '' : 's'} · ${fmtNum(p.total_quantity)} units`,
      crumbs: [{ label: 'Orders', href: '#/admin/orders' }, { label: p.order_id }],
      actions: `${actions}<button class="btn" onclick="window.print()">Print</button>`,
    }) +
    `
    ${
      p.status === 'CANCELLED'
        ? `<div class="notice warn" style="margin-bottom:18px">${icon('ban')}<div><strong>This order was cancelled on ${fmtDateTime(p.cancelled_at)}.</strong>
             Its stock was returned. The record is kept for audit history.${p.cancel_reason ? `<br>Reason: ${esc(p.cancel_reason)}` : ''}</div></div>`
        : ''
    }
    ${
      changed.length
        ? `<section class="card" style="margin-bottom:18px">
            <div class="card-head"><h2>Stock adjusted by this update</h2><span class="badge green">Saved</span></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Item</th><th>Line</th><th class="num">Old Qty</th><th class="num">New Qty</th><th class="num">Stock Change</th><th class="num">Stock Before</th><th class="num">Stock After</th></tr></thead>
              <tbody>${changed
                .map(
                  (a) => `<tr>
                    <td class="name">${esc(a.item_name)}</td>
                    <td><span class="badge plain ${a.action === 'removed' ? 'red' : a.action === 'added' ? 'blue' : ''}">${esc(a.action)}</span></td>
                    <td class="num">${fmtNum(a.old_quantity)}</td>
                    <td class="num">${fmtNum(a.new_quantity)}</td>
                    <td class="num">${signed(a.stock_change)}</td>
                    <td class="num">${fmtNum(a.stock_before)}</td>
                    <td class="num"><strong>${fmtNum(a.stock_after)}</strong></td>
                  </tr>`
                )
                .join('')}</tbody>
            </table></div>
          </section>`
        : ''
    }

    <section class="card">
      <div class="card-head"><h2>Purchase information</h2></div>
      <div class="card-body">
        <dl class="dl">
          <div><dt>Order ID</dt><dd class="order-id">${esc(p.order_id)}</dd></div>
          <div><dt>Purchase Date</dt><dd>${fmtDate(p.purchase_date)}</dd></div>
          <div><dt>Status</dt><dd>${purchaseStatusBadge(p.status)}</dd></div>
          <div><dt>Items / Units</dt><dd>${p.line_count} / ${fmtNum(p.total_quantity)}</dd></div>
          <div><dt>Order Total</dt><dd>${money(p.total_amount)}</dd></div>
          <div><dt>Created</dt><dd>${fmtDateTime(p.created_at)}</dd></div>
          <div><dt>Last Updated</dt><dd>${fmtDateTime(p.updated_at)}</dd></div>
          ${p.remarks ? `<div style="grid-column:1/-1"><dt>Remarks</dt><dd>${esc(p.remarks)}</dd></div>` : ''}
        </dl>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Items in this order</h2><span class="hint">Stock shown is the current stock</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>#</th><th>Item ID</th><th>Item</th><th>Item Type</th><th class="num">Quantity</th><th class="num">Unit Price</th><th class="num">Line Total</th>
            <th class="num">Current Stock</th><th>Availability</th><th>Item Status</th>
          </tr></thead>
          <tbody>
            ${p.items
              .map(
                (line, index) => `
              <tr class="${line.item_active ? '' : 'row-inactive'}">
                <td class="id">${index + 1}</td>
                <td class="id">#${line.item_id}</td>
                <td class="name"><a href="#/admin/products/${line.item_id}">${esc(line.item_name)}</a></td>
                <td>${esc(line.type_name)}</td>
                <td class="num"><strong>${fmtNum(line.quantity)}</strong></td>
                <td class="num">${money(line.unit_price)}</td>
                <td class="num">${money(line.line_total)}</td>
                <td class="num">${fmtNum(line.current_stock)}</td>
                <td>${availabilityBadge(line.availability)}</td>
                <td>${statusBadge(line.item_active)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="4">Total</td><td class="num">${fmtNum(p.total_quantity)}</td><td></td><td class="num">${money(p.total_amount)}</td><td colspan="3"></td>
          </tr></tfoot>
        </table>
      </div>
      <div class="card-foot">
        <span class="legend">${icon('lock')}Purchases are historical transactions and cannot be deleted.</span>
        <a class="btn" href="#/admin/orders">${icon('back')}All orders</a>
      </div>
    </section>`;

  const cancelBtn = view.querySelector('#btn-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const result = await confirmDialog({
        title: `Cancel order ${p.order_id}?`,
        message: `All ${fmtNum(p.total_quantity)} units will be returned to stock. The purchase is <strong>not deleted</strong> — it stays in history with status “Cancelled” and can no longer be updated.`,
        confirmText: 'Cancel Order',
        cancelText: 'Keep Order',
        tone: 'danger',
        iconName: 'ban',
        input: { label: 'Reason (optional)', placeholder: 'e.g. Ordered by mistake', maxLength: 255 },
      });
      if (!result) return;
      try {
        const res = await api.purchases.cancel(p.id, result.value);
        toast(res.message);
        navigate(`#/admin/orders/${p.id}`);
      } catch (error) {
        toastError(error);
      }
    });
  }
}
