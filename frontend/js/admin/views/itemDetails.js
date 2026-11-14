import { api } from '../../api.js';
import { productArt } from '../../store/art.js';
import { navigate } from '../../state.js';
import {
  availabilityBadge, confirmDialog, emptyState, esc, fmtDate, fmtDateTime, fmtNum, icon, pageHead,
  money, purchaseStatusBadge, signed, skeletonRows, statusBadge, toast, toastError,
} from '../../ui.js';

const MOVEMENT_LABELS = {
  INITIAL: 'Opening stock',
  ADJUSTMENT: 'Manual adjustment',
  PURCHASE: 'Purchase',
  PURCHASE_UPDATE: 'Purchase updated',
  PURCHASE_CANCEL: 'Purchase cancelled',
};

export async function render(view, params, ctx) {
  view.innerHTML =
    pageHead({ title: 'Product details', crumbs: [{ label: 'Products', href: '#/admin/products' }, { label: `#${params.id}` }] }) +
    `<div class="card">${skeletonRows(6)}</div>`;

  const { data: item } = await api.items.get(params.id);
  if (!ctx.isCurrent()) return;

  const deleteAction = item.can_delete
    ? `<button class="btn danger" id="btn-delete">${icon('trash')}Delete</button>`
    : `<button class="btn" disabled title="Used in ${item.purchase_count} purchase(s). Deactivate instead.">${icon('lock')}Delete</button>`;

  view.innerHTML =
    pageHead({
      title: `${esc(item.name)} ${statusBadge(item.active)}`,
      subtitle: `${esc(item.type_name)} · Item #${item.id}`,
      crumbs: [{ label: 'Products', href: '#/admin/products' }, { label: item.name }],
      actions: `
        <a class="btn" href="#/product/${item.id}" title="See how shoppers see it">${icon('store')}View in store</a>
        <a class="btn" href="#/admin/products/${item.id}/edit">${icon('edit')}Edit</a>
        <button class="btn ${item.active ? '' : 'success'}" id="btn-toggle">${icon('power')}${item.active ? 'Deactivate' : 'Activate'}</button>
        ${deleteAction}`,
    }) +
    `
    ${
      item.active
        ? ''
        : `<div class="notice warn" style="margin-bottom:18px">${icon('ban')}<div><strong>This item is inactive.</strong> It remains visible in purchase history but cannot be selected for new purchases.</div></div>`
    }
    <div class="grid side">
      <section class="card">
        <div class="card-head"><h2>Item information</h2></div>
        <div class="card-body">
          <dl class="dl">
            <div><dt>Item ID</dt><dd>#${item.id}</dd></div>
            <div><dt>Item Name</dt><dd>${esc(item.name)}</dd></div>
            <div><dt>Item Type</dt><dd>${esc(item.type_name)}</dd></div>
            <div><dt>Purchase Date</dt><dd>${fmtDate(item.purchase_date)}</dd></div>
            <div><dt>Price</dt><dd>${money(item.price)}</dd></div>
            ${item.description ? `<div style="grid-column:1/-1"><dt>Description</dt><dd style="font-weight:500">${esc(item.description)}</dd></div>` : ''}
            <div><dt>Status</dt><dd>${statusBadge(item.active)}</dd></div>
            <div><dt>Availability</dt><dd>${availabilityBadge(item.availability)}</dd></div>
            <div><dt>Created</dt><dd>${fmtDateTime(item.created_at)}</dd></div>
            <div><dt>Last Updated</dt><dd>${fmtDateTime(item.updated_at)}</dd></div>
          </dl>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Stock</h2>${availabilityBadge(item.availability)}</div>
        <div class="card-body">
          <div style="width:120px;height:120px;border-radius:20px;overflow:hidden;margin-bottom:18px">${productArt(item, { soldOut: !item.stock_available })}</div>
          <div class="big-number">${fmtNum(item.stock_available)}</div>
          <div class="big-label">units currently available</div>
          <dl class="dl" style="margin-top:20px">
            <div><dt>Orders</dt><dd>${fmtNum(item.stats.orders)}</dd></div>
            <div><dt>Units purchased</dt><dd>${fmtNum(item.stats.units_purchased)}</dd></div>
          </dl>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>Purchase history</h2><span class="hint">${item.purchase_history.length} order line(s)</span></div>
      ${
        item.purchase_history.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Order ID</th><th>Purchase Date</th><th class="num">Quantity</th><th class="num">Unit Price</th><th>Order Status</th><th></th></tr></thead>
              <tbody>${item.purchase_history
                .map(
                  (h) => `<tr>
                    <td><a class="order-id" href="#/admin/orders/${h.purchase_id}">${esc(h.order_id)}</a></td>
                    <td>${fmtDate(h.purchase_date)}</td>
                    <td class="num"><strong>${fmtNum(h.quantity)}</strong></td>
                    <td class="num">${money(h.unit_price)}</td>
                    <td>${purchaseStatusBadge(h.status)}</td>
                    <td><a class="btn sm" href="#/admin/orders/${h.purchase_id}">${icon('eye')}View</a></td>
                  </tr>`
                )
                .join('')}</tbody></table></div>`
          : emptyState({ iconName: 'cart', title: 'Not purchased yet', text: 'This item has not been used in any purchase.' })
      }
    </section>

    <section class="card">
      <div class="card-head"><h2>Stock movements</h2><span class="hint">Audit trail of every stock change</span></div>
      ${
        item.stock_movements.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Date</th><th>Movement</th><th>Reference</th><th class="num">Change</th><th class="num">Balance After</th><th>Note</th></tr></thead>
              <tbody>${item.stock_movements
                .map(
                  (m) => `<tr>
                    <td class="muted">${fmtDateTime(m.created_at)}</td>
                    <td>${esc(MOVEMENT_LABELS[m.movement_type] || m.movement_type)}</td>
                    <td>${m.order_id ? `<a class="order-id" href="#/admin/orders/${m.purchase_id}">${esc(m.order_id)}</a>` : '<span class="muted">—</span>'}</td>
                    <td class="num">${signed(m.quantity_change)}</td>
                    <td class="num"><strong>${fmtNum(m.balance_after)}</strong></td>
                    <td class="wrap">${esc(m.note || '')}</td>
                  </tr>`
                )
                .join('')}</tbody></table></div>`
          : emptyState({ iconName: 'layers', title: 'No stock movements' })
      }
    </section>`;

  view.querySelector('#btn-toggle').addEventListener('click', async () => {
    if (item.active) {
      const ok = await confirmDialog({
        title: `Deactivate “${item.name}”?`,
        message: 'Inactive items stay visible in purchase history but cannot be selected for new purchases.',
        confirmText: 'Deactivate',
        iconName: 'power',
      });
      if (!ok) return;
    }
    try {
      const res = await api.items.setStatus(item.id, !item.active);
      toast(res.message);
      navigate(`#/admin/products/${item.id}`);
    } catch (error) {
      toastError(error);
    }
  });

  const del = view.querySelector('#btn-delete');
  if (del) {
    del.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete “${item.name}”?`,
        message: 'This item has no purchase history and will be permanently deleted. This cannot be undone.',
        confirmText: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        const res = await api.items.remove(item.id);
        toast(res.message);
        navigate('#/admin/products');
      } catch (error) {
        toastError(error);
      }
    });
  }
}
