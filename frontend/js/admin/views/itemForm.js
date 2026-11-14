import { api } from '../../api.js';
import { navigate } from '../../state.js';
import {
  applyFieldErrors, clearFieldErrors, errorNotice, esc, fieldErrorSlot, fmtNum, icon, pageHead, setLoading,
  skeletonRows, toast, todayISO,
} from '../../ui.js';

/** Item Master form - create (#/admin/products/new) and update (#/admin/products/:id/edit) */
export async function render(view, params, ctx) {
  const editing = params.mode === 'edit';
  view.innerHTML =
    pageHead({ title: editing ? 'Edit product' : 'Add product', crumbs: [{ label: 'Products', href: '#/admin/products' }, { label: editing ? 'Edit' : 'New' }] }) +
    `<div class="card">${skeletonRows(5)}</div>`;

  const [typesRes, itemRes] = await Promise.all([
    api.itemTypes.list(),
    editing ? api.items.get(params.id) : Promise.resolve(null),
  ]);
  if (!ctx.isCurrent()) return;
  const types = typesRes.data;
  const item = itemRes ? itemRes.data : null;

  const values = item || {
    name: '',
    item_type_id: '',
    purchase_date: todayISO(),
    stock_available: '',
    price: '',
    description: '',
    active: true,
  };

  const noTypes = !types.length
    ? `<div class="notice warn">${icon('alert')}<div>No item types exist yet. <a href="#/admin/categories">Create an item type</a> first.</div></div>`
    : '';

  view.innerHTML =
    pageHead({
      title: editing ? `Edit ${esc(item.name)}` : 'Add product',
      subtitle: editing ? `Item #${item.id}` : 'Create a new item in the item master.',
      crumbs: [{ label: 'Products', href: '#/admin/products' }, ...(editing ? [{ label: item.name, href: `#/admin/products/${item.id}` }] : []), { label: editing ? 'Edit' : 'New' }],
    }) +
    `
    <form class="card" id="item-form" novalidate>
      <div class="card-head"><h2>Item master</h2><span class="hint">Fields marked <span style="color:var(--red)">*</span> are required</span></div>
      <div class="card-body stack">
        ${noTypes}
        <div id="form-error"></div>
        <div class="form-grid">
          <div class="field full" data-field="name">
            <label for="name">Item Name <span class="req">*</span></label>
            <input id="name" name="name" class="input" maxlength="100" value="${esc(values.name)}" placeholder="e.g. Laptop" autocomplete="off" />
            ${fieldErrorSlot()}
          </div>
          <div class="field" data-field="item_type_id">
            <label for="item_type_id">Item Type <span class="req">*</span></label>
            <select id="item_type_id" name="item_type_id" class="input">
              <option value="">Select item type…</option>
              ${types.map((t) => `<option value="${t.id}" ${String(t.id) === String(values.item_type_id) ? 'selected' : ''}>${esc(t.type_name)}</option>`).join('')}
            </select>
            ${fieldErrorSlot()}
            <span class="help"><a href="#/admin/categories">Manage item types</a></span>
          </div>
          <div class="field" data-field="purchase_date">
            <label for="purchase_date">Purchase Date <span class="req">*</span></label>
            <input id="purchase_date" name="purchase_date" type="date" class="input" value="${esc(values.purchase_date)}" />
            ${fieldErrorSlot()}
          </div>
          <div class="field" data-field="stock_available">
            <label for="stock_available">Stock Available <span class="req">*</span></label>
            <input id="stock_available" name="stock_available" type="number" min="0" step="1" inputmode="numeric" class="input num" value="${esc(values.stock_available)}" placeholder="0" />
            ${fieldErrorSlot()}
            <span class="help" id="stock-help">${
              editing ? `Current stock is ${fmtNum(item.stock_available)}. A change is logged as a manual stock adjustment.` : 'Opening stock. Cannot be negative.'
            }</span>
          </div>
          <div class="field" data-field="price">
            <label for="price">Price (₹) <span class="req">*</span></label>
            <input id="price" name="price" type="number" min="0" step="0.01" inputmode="decimal" class="input num" value="${esc(values.price)}" placeholder="0.00" />
            ${fieldErrorSlot()}
            <span class="help">Selling price shown in the store. Past orders keep the price they were placed at.</span>
          </div>
          <div class="field full" data-field="description">
            <label for="description">Description <span class="help" style="font-weight:500">(optional)</span></label>
            <textarea id="description" name="description" class="input" maxlength="500" placeholder="Short product description shown on the product page">${esc(values.description || '')}</textarea>
            ${fieldErrorSlot()}
          </div>
          <div class="field" data-field="active">
            <span class="label" id="status-label">Status <span class="req">*</span></span>
            <div class="segmented" role="radiogroup" aria-labelledby="status-label">
              <input type="radio" id="st-active" name="active" value="true" ${values.active ? 'checked' : ''} />
              <label for="st-active"><span class="dot" style="background:#0071e3"></span>Active</label>
              <input type="radio" id="st-inactive" name="active" value="false" ${values.active ? '' : 'checked'} />
              <label for="st-inactive"><span class="dot" style="background:#8e8e93"></span>Inactive</label>
            </div>
            ${fieldErrorSlot()}
            <span class="help">Inactive items cannot be selected for new purchases.</span>
          </div>
        </div>
      </div>
      <div class="card-foot">
        <a class="btn" href="${editing ? `#/admin/products/${item.id}` : '#/admin/products'}">Cancel</a>
        <button class="btn primary lg" type="submit" ${types.length ? '' : 'disabled'}>${icon('check')}${editing ? 'Save changes' : 'Create product'}</button>
      </div>
    </form>`;

  const form = view.querySelector('#item-form');
  if (!editing) form.elements['name'].focus();

  // live hint for stock changes on edit
  if (editing) {
    const help = view.querySelector('#stock-help');
    form.stock_available.addEventListener('input', () => {
      const v = Number(form.stock_available.value);
      if (form.stock_available.value === '' || !Number.isInteger(v)) return;
      const diff = v - item.stock_available;
      help.innerHTML =
        diff === 0
          ? `Current stock is ${fmtNum(item.stock_available)}. A change is logged as a manual stock adjustment.`
          : `Stock will change by <strong>${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff))}</strong> (${fmtNum(item.stock_available)} → ${fmtNum(v)}).`;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    view.querySelector('#form-error').innerHTML = '';

    const payload = {
      name: form.elements['name'].value.trim(),
      item_type_id: form.item_type_id.value ? Number(form.item_type_id.value) : '',
      purchase_date: form.purchase_date.value,
      stock_available: form.stock_available.value === '' ? '' : Number(form.stock_available.value),
      price: form.elements['price'].value === '' ? '' : Number(form.elements['price'].value),
      description: form.elements['description'].value.trim(),
      active: form.querySelector('input[name="active"]:checked')?.value === 'true',
    };

    // client-side checks mirror the backend rules (backend remains authoritative)
    const errors = [];
    if (!payload.name) errors.push({ field: 'name', message: 'Item name is required' });
    if (!payload.item_type_id) errors.push({ field: 'item_type_id', message: 'Item type is required' });
    if (!payload.purchase_date) errors.push({ field: 'purchase_date', message: 'Purchase date is required' });
    if (payload.stock_available === '') errors.push({ field: 'stock_available', message: 'Stock available is required' });
    else if (!Number.isInteger(payload.stock_available)) errors.push({ field: 'stock_available', message: 'Stock must be a whole number' });
    else if (payload.stock_available < 0) errors.push({ field: 'stock_available', message: 'Stock cannot be negative' });
    if (payload.price === '') errors.push({ field: 'price', message: 'Price is required' });
    else if (Number.isNaN(payload.price) || payload.price < 0) errors.push({ field: 'price', message: 'Price cannot be negative' });
    else if (!/^\d+(\.\d{1,2})?$/.test(form.elements['price'].value.trim())) errors.push({ field: 'price', message: 'Price can have at most 2 decimal places' });
    if (errors.length) {
      applyFieldErrors(form, { details: errors });
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
      const res = editing ? await api.items.update(item.id, payload) : await api.items.create(payload);
      toast(res.message);
      navigate(`#/admin/products/${res.data.id}`);
    } catch (error) {
      const unmatched = applyFieldErrors(form, error);
      if (!error.details.length || unmatched.length) {
        view.querySelector('#form-error').innerHTML = errorNotice(error);
      }
    } finally {
      setLoading(button, false);
    }
  });
}
