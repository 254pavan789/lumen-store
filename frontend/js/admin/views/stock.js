import { api } from '../../api.js';
import { productThumb } from '../../store/art.js';
import {
  availabilityBadge, availabilityTone, debounce, emptyState, esc, fmtNum, icon, pageHead, skeletonRows, statusBadge,
  toastError,
} from '../../ui.js';

const FILTERS = [
  { key: 'all', label: 'All Items', tone: '' },
  { key: 'in', label: 'In Stock', tone: 'green' },
  { key: 'low', label: 'Low Stock', tone: 'orange' },
  { key: 'out', label: 'Out of Stock', tone: 'red' },
];

export async function render(view, params, ctx) {
  const fromHash = new URLSearchParams(location.hash.split('?')[1] || '').get('f');
  const state = { availability: FILTERS.some((f) => f.key === fromHash) ? fromHash : 'all', search: '' };

  view.innerHTML =
    pageHead({
      title: 'Inventory',
      subtitle: 'Live stock for every product. Stock drops automatically when an order is placed and returns when one is reduced or cancelled.',
    }) +
    `
    <section class="stats" id="stock-stats">${FILTERS.map(() => '<div class="stat"><div class="skeleton" style="height:44px"></div></div>').join('')}</section>
    <section class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" id="s-search" type="search" placeholder="Search items…" aria-label="Search items" /></div>
        <span class="legend" id="legend"></span>
      </div>
      <div id="s-table">${skeletonRows(6)}</div>
    </section>`;

  const load = async () => {
    let res;
    try {
      res = await api.stock({ availability: state.availability, search: state.search });
    } catch (error) {
      toastError(error);
      return;
    }
    if (!ctx.isCurrent()) return;
    // summary always reflects all items (independent of the availability filter)
    const all = state.availability === 'all' ? res : await api.stock({ search: state.search });
    if (!ctx.isCurrent()) return;
    renderStats(view, all.meta, state, load);
    renderTable(view, res.data, state);
  };

  view.querySelector('#s-search').addEventListener(
    'input',
    debounce((e) => {
      state.search = e.target.value.trim();
      load();
    }, 250)
  );
  await load();
}

function renderStats(view, meta, state, load) {
  const counts = { all: meta.total_items, in: meta.in_stock, low: meta.low_stock, out: meta.out_of_stock };
  const subs = {
    all: `${fmtNum(meta.total_units)} units on hand`,
    in: `stock > ${meta.low_stock_threshold}`,
    low: `stock 1 – ${meta.low_stock_threshold}`,
    out: 'stock = 0',
  };
  const holder = view.querySelector('#stock-stats');
  holder.innerHTML = FILTERS.map(
    (f) => `
      <a class="stat ${f.tone} ${state.availability === f.key ? 'selected' : ''}" href="#/admin/inventory?f=${f.key}" data-filter="${f.key}" aria-pressed="${state.availability === f.key}">
        <span class="label">${f.label}</span>
        <span class="value">${fmtNum(counts[f.key])}</span>
        <span class="sub">${subs[f.key]}</span>
      </a>`
  ).join('');
  holder.querySelectorAll('[data-filter]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      state.availability = a.dataset.filter;
      history.replaceState(null, '', `#/admin/inventory?f=${state.availability}`);
      load();
    })
  );
  view.querySelector('#legend').innerHTML =
    `${availabilityBadge('In Stock')}&gt; ${meta.low_stock_threshold} ${availabilityBadge('Low Stock')}1–${meta.low_stock_threshold} ${availabilityBadge('Out of Stock')}0`;
}

function renderTable(view, rows, state) {
  const holder = view.querySelector('#s-table');
  if (!rows.length) {
    holder.innerHTML = emptyState({ iconName: 'bars', title: 'No items match', text: state.search ? 'Try another search.' : 'No items in this category.' });
    return;
  }
  const max = Math.max(...rows.map((r) => r.stock_available), 1);
  holder.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Item ID</th><th>Product</th><th>Category</th><th>Status</th><th>Current Stock</th><th>Availability</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr class="${r.active ? '' : 'row-inactive'}">
              <td class="id">#${r.id}</td>
              <td class="name"><a class="cell-product" href="#/admin/products/${r.id}">${productThumb(r, 40)}<span>${esc(r.name)}</span></a></td>
              <td>${esc(r.type_name)}</td>
              <td>${statusBadge(r.active)}</td>
              <td>
                <div class="stockbar">
                  <div class="track"><div class="fill ${availabilityTone(r.availability)}" style="width:${Math.max((r.stock_available / max) * 100, r.stock_available ? 2 : 0)}%"></div></div>
                  <span class="n">${fmtNum(r.stock_available)}</span>
                </div>
              </td>
              <td>${availabilityBadge(r.availability)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}
