import { api } from '../../api.js';
import { productThumb } from '../../store/art.js';
import {
  availabilityBadge, confirmDialog, debounce, emptyState, esc, fmtDate, fmtNum, icon, pageHead, skeletonRows,
  money, statusBadge, toast, toastError,
} from '../../ui.js';

const KEYS = ['search', 'type', 'status', 'availability'];

function loadFilters() {
  const f = {};
  KEYS.forEach((k) => (f[k] = sessionStorage.getItem(`items.${k}`) || ''));
  return f;
}

function saveFilters(f) {
  KEYS.forEach((k) => sessionStorage.setItem(`items.${k}`, f[k] || ''));
}

export async function render(view, params, ctx) {
  const filters = loadFilters();
  view.innerHTML =
    pageHead({
      title: 'Products',
      subtitle: 'Item master: every product with its price, current stock, availability and status.',
      actions: `<a class="btn primary" href="#/admin/products/new">${icon('plus')}Add product</a>`,
    }) +
    `
    <section class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" id="f-search" type="search" placeholder="Search by item or type…" value="${esc(filters.search)}" aria-label="Search items" /></div>
        <select class="input" id="f-type" aria-label="Filter by item type"><option value="">All types</option></select>
        <select class="input" id="f-status" aria-label="Filter by status">
          <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <select class="input" id="f-availability" aria-label="Filter by availability">
          <option value="">All availability</option><option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option>
        </select>
        <span class="count" id="item-count"></span>
      </div>
      <div id="item-table">${skeletonRows(6)}</div>
    </section>`;

  const typeSelect = view.querySelector('#f-type');
  const { data: types } = await api.itemTypes.list();
  if (!ctx.isCurrent()) return;
  typeSelect.insertAdjacentHTML('beforeend', types.map((t) => `<option value="${t.id}">${esc(t.type_name)}</option>`).join(''));
  typeSelect.value = filters.type;
  view.querySelector('#f-status').value = filters.status;
  view.querySelector('#f-availability').value = filters.availability;

  const refresh = () => {
    filters.search = view.querySelector('#f-search').value.trim();
    filters.type = typeSelect.value;
    filters.status = view.querySelector('#f-status').value;
    filters.availability = view.querySelector('#f-availability').value;
    saveFilters(filters);
    loadTable(view, ctx, filters);
  };
  view.querySelector('#f-search').addEventListener('input', debounce(refresh, 250));
  ['#f-type', '#f-status', '#f-availability'].forEach((sel) => view.querySelector(sel).addEventListener('change', refresh));

  await loadTable(view, ctx, filters);
}

async function loadTable(view, ctx, filters) {
  const holder = view.querySelector('#item-table');
  let data;
  try {
    ({ data } = await api.items.list({
      search: filters.search,
      type_id: filters.type,
      status: filters.status,
      availability: filters.availability,
    }));
  } catch (error) {
    toastError(error);
    return;
  }
  if (!ctx.isCurrent()) return;
  view.querySelector('#item-count').textContent = `${data.length} item${data.length === 1 ? '' : 's'}`;

  const filtered = KEYS.some((k) => filters[k]);
  if (!data.length) {
    holder.innerHTML = filtered
      ? emptyState({ iconName: 'search', title: 'No matching products', text: 'Try a different search or clear the filters.' })
      : emptyState({
          iconName: 'box',
          title: 'No products yet',
          text: 'Create your first product to start selling.',
          action: `<a class="btn primary" href="#/admin/products/new">${icon('plus')}Add product</a>`,
        });
    return;
  }

  holder.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Item ID</th><th>Product</th><th>Category</th><th>Purchase Date</th><th class="num">Price</th>
          <th class="num">Current Stock</th><th>Availability</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${data.map(rowHtml).join('')}
        </tbody>
      </table>
    </div>`;

  holder.querySelectorAll('[data-toggle]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const activate = btn.dataset.active !== 'true';
      if (!activate) {
        const ok = await confirmDialog({
          title: `Deactivate “${btn.dataset.name}”?`,
          message: 'Inactive items stay visible in purchase history but cannot be selected for new purchases.',
          confirmText: 'Deactivate',
          iconName: 'power',
        });
        if (!ok) return;
      }
      try {
        const res = await api.items.setStatus(btn.dataset.toggle, activate);
        toast(res.message);
        loadTable(view, ctx, filters);
      } catch (error) {
        toastError(error);
      }
    })
  );

  holder.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete “${btn.dataset.name}”?`,
        message: 'This item has no purchase history and will be permanently deleted.',
        confirmText: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        const res = await api.items.remove(btn.dataset.delete);
        toast(res.message);
        loadTable(view, ctx, filters);
      } catch (error) {
        toastError(error);
      }
    })
  );
}

function rowHtml(item) {
  const deleteBtn = item.can_delete
    ? `<button class="btn sm danger icon" data-delete="${item.id}" data-name="${esc(item.name)}" title="Delete" aria-label="Delete ${esc(item.name)}">${icon('trash')}</button>`
    : `<button class="btn sm icon" disabled title="Used in ${item.purchase_count} purchase(s) — cannot be deleted. Deactivate instead." aria-label="Delete not allowed">${icon('lock')}</button>`;
  return `
    <tr class="${item.active ? '' : 'row-inactive'}">
      <td class="id">#${item.id}</td>
      <td class="name"><a class="cell-product" href="#/admin/products/${item.id}">${productThumb(item, 40)}<span>${esc(item.name)}</span></a></td>
      <td>${esc(item.type_name)}</td>
      <td class="muted">${fmtDate(item.purchase_date)}</td>
      <td class="num">${money(item.price)}</td>
      <td class="num"><strong>${fmtNum(item.stock_available)}</strong></td>
      <td>${availabilityBadge(item.availability)}</td>
      <td>${statusBadge(item.active)}</td>
      <td>
        <div class="actions">
          <a class="btn sm icon" href="#/admin/products/${item.id}" title="View details" aria-label="View ${esc(item.name)}">${icon('eye')}</a>
          <a class="btn sm icon" href="#/admin/products/${item.id}/edit" title="Edit" aria-label="Edit ${esc(item.name)}">${icon('edit')}</a>
          <button class="btn sm ${item.active ? '' : 'success'}" data-toggle="${item.id}" data-active="${item.active}" data-name="${esc(item.name)}">
            ${icon('power')}${item.active ? 'Deactivate' : 'Activate'}
          </button>
          ${deleteBtn}
        </div>
      </td>
    </tr>`;
}
