import { api } from '../../api.js';
import {
  debounce, emptyState, esc, fmtDate, fmtNum, icon, money, pageHead, purchaseStatusBadge, skeletonRows, toastError,
} from '../../ui.js';

const filters = { search: '', status: '', date_from: '', date_to: '' };

export async function render(view, params, ctx) {
  view.innerHTML =
    pageHead({
      title: 'Orders',
      subtitle: 'Every purchase order with its items. Orders are permanent records and cannot be deleted.',
      actions: `<a class="btn primary" href="#/admin/orders/new">${icon('plus')}New order</a>`,
    }) +
    `
    <section class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" id="p-search" type="search" placeholder="Search Order ID or item…" value="${esc(filters.search)}" aria-label="Search purchases" /></div>
        <select class="input" id="p-status" aria-label="Filter by status">
          <option value="">All statuses</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <input class="input" id="p-from" type="date" value="${esc(filters.date_from)}" aria-label="From date" title="From date" style="width:auto" />
        <input class="input" id="p-to" type="date" value="${esc(filters.date_to)}" aria-label="To date" title="To date" style="width:auto" />
        <span class="count" id="p-count"></span>
      </div>
      <div id="p-table">${skeletonRows(6)}</div>
      <div class="card-foot"><span class="legend">${icon('lock')}Purchases are historical transactions — there is no delete action. Use “Cancel order” on the details page if an order must be voided.</span></div>
    </section>`;

  view.querySelector('#p-status').value = filters.status;
  const refresh = () => {
    filters.search = view.querySelector('#p-search').value.trim();
    filters.status = view.querySelector('#p-status').value;
    filters.date_from = view.querySelector('#p-from').value;
    filters.date_to = view.querySelector('#p-to').value;
    loadTable(view, ctx);
  };
  view.querySelector('#p-search').addEventListener('input', debounce(refresh, 250));
  ['#p-status', '#p-from', '#p-to'].forEach((s) => view.querySelector(s).addEventListener('change', refresh));
  await loadTable(view, ctx);
}

async function loadTable(view, ctx) {
  const holder = view.querySelector('#p-table');
  let data;
  try {
    ({ data } = await api.purchases.list(filters));
  } catch (error) {
    toastError(error);
    return;
  }
  if (!ctx.isCurrent()) return;
  view.querySelector('#p-count').textContent = `${data.length} order${data.length === 1 ? '' : 's'}`;

  if (!data.length) {
    const filtered = Object.values(filters).some(Boolean);
    holder.innerHTML = filtered
      ? emptyState({ iconName: 'search', title: 'No matching purchases', text: 'Try a different search or date range.' })
      : emptyState({
          iconName: 'cart',
          title: 'No purchases yet',
          text: 'Create a purchase order with one or more items.',
          action: `<a class="btn primary" href="#/admin/orders/new">${icon('plus')}New Purchase</a>`,
        });
    return;
  }

  holder.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Order ID</th><th>Purchase Date</th><th>Items</th><th class="num">Lines</th><th class="num">Total Qty</th><th class="num">Amount</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${data
            .map(
              (p) => `
            <tr>
              <td class="name"><a class="order-id" href="#/admin/orders/${p.id}">${esc(p.order_id)}</a></td>
              <td>${fmtDate(p.purchase_date)}</td>
              <td class="wrap">${esc(p.items_summary || '')}</td>
              <td class="num">${p.line_count}</td>
              <td class="num"><strong>${fmtNum(p.total_quantity)}</strong></td>
              <td class="num">${money(p.total_amount)}</td>
              <td>${purchaseStatusBadge(p.status)}</td>
              <td>
                <div class="actions">
                  <a class="btn sm" href="#/admin/orders/${p.id}">${icon('eye')}View</a>
                  ${p.status === 'COMPLETED' ? `<a class="btn sm" href="#/admin/orders/${p.id}/edit">${icon('edit')}Update</a>` : ''}
                </div>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}
