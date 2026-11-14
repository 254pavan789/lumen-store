import { api } from '../../api.js';
import { flash, navigate } from '../../state.js';
import {
  applyFieldErrors, clearFieldErrors, errorNotice, esc, fieldErrorSlot, fmtNum, icon, money, pageHead,
  purchaseStatusBadge, setFieldError, setLoading, signed, skeletonRows, toast, todayISO,
} from '../../ui.js';

/**
 * Create Purchase (#/admin/orders/new) and Update Purchase (#/admin/orders/:id/edit).
 * One order holds many items; lines can be added / edited / removed before submit.
 */
export async function render(view, params, ctx) {
  const editing = params.mode === 'edit';
  const title = editing ? 'Update order' : 'New order';
  view.innerHTML =
    pageHead({ title, crumbs: [{ label: 'Orders', href: '#/admin/orders' }, { label: editing ? 'Update' : 'New' }] }) +
    `<div class="card">${skeletonRows(6)}</div>`;

  const [itemsRes, extraRes] = await Promise.all([
    api.items.list({ sort: 'name' }),
    editing ? api.purchases.get(params.id) : api.purchases.nextOrderId(),
  ]);
  if (!ctx.isCurrent()) return;

  const state = {
    editing,
    purchase: editing ? extraRes.data : null,
    items: new Map(itemsRes.data.map((i) => [i.id, i])),
    original: new Map(),
    lines: [],
  };

  if (editing) {
    const p = state.purchase;
    if (p.status !== 'COMPLETED') {
      view.innerHTML =
        pageHead({ title: `Update ${esc(p.order_id)}`, crumbs: [{ label: 'Orders', href: '#/admin/orders' }, { label: p.order_id, href: `#/admin/orders/${p.id}` }, { label: 'Update' }] }) +
        `<div class="card"><div class="card-body"><div class="notice warn">${icon('ban')}<div><strong>This purchase is cancelled.</strong> Cancelled purchases are kept for history and cannot be updated.</div></div>
         <div style="margin-top:16px"><a class="btn" href="#/admin/orders/${p.id}">${icon('back')}Back to details</a></div></div></div>`;
      return;
    }
    p.items.forEach((line) => {
      state.original.set(line.item_id, line.quantity);
      state.lines.push({ item_id: line.item_id, quantity: line.quantity });
    });
  }

  const orderId = editing ? state.purchase.order_id : extraRes.data.order_id;
  const purchaseDate = editing ? state.purchase.purchase_date : todayISO();
  const remarks = editing ? state.purchase.remarks || '' : '';

  view.innerHTML =
    pageHead({
      title: editing ? `Update ${esc(orderId)} ${purchaseStatusBadge(state.purchase.status)}` : 'New order',
      subtitle: editing
        ? 'Change quantities, add or remove lines. Stock is adjusted by the difference between old and new quantities.'
        : 'Add one or more items to this order. Stock is validated and deducted on the server when you submit.',
      crumbs: [
        { label: 'Orders', href: '#/admin/orders' },
        ...(editing ? [{ label: orderId, href: `#/admin/orders/${state.purchase.id}` }] : []),
        { label: editing ? 'Update' : 'New' },
      ],
    }) +
    `
    <form id="purchase-form" novalidate>
      <section class="card">
        <div class="card-head"><h2>Purchase information</h2></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field" data-field="order_id">
              <label for="order_id">Order ID ${editing ? '' : '<span class="req">*</span>'}</label>
              <input id="order_id" name="order_id" class="input mono" maxlength="30" value="${esc(orderId)}" ${editing ? 'readonly' : ''} autocomplete="off" />
              ${fieldErrorSlot()}
              <span class="help">${editing ? 'The Order ID cannot be changed.' : 'Auto-generated unique ID. You may enter your own (letters, numbers, - or _).'}</span>
            </div>
            <div class="field" data-field="purchase_date">
              <label for="purchase_date">Purchase Date <span class="req">*</span></label>
              <input id="purchase_date" name="purchase_date" type="date" class="input" value="${esc(purchaseDate)}" />
              ${fieldErrorSlot()}
            </div>
            <div class="field full" data-field="remarks">
              <label for="remarks">Remarks <span class="help" style="font-weight:400">(optional)</span></label>
              <input id="remarks" name="remarks" class="input" maxlength="255" value="${esc(remarks)}" placeholder="e.g. Quarterly office refresh" />
              ${fieldErrorSlot()}
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Add items</h2><span class="hint">Only active items with stock can be selected</span></div>
        <div class="card-body">
          <div class="line-builder" id="builder">
            <div class="field" data-field="new_item">
              <label for="new_item">Item</label>
              <select id="new_item" class="input"></select>
              ${fieldErrorSlot()}
            </div>
            <div class="field" data-field="new_qty">
              <label for="new_qty">Quantity</label>
              <input id="new_qty" type="number" min="1" step="1" value="1" inputmode="numeric" class="input num" />
              ${fieldErrorSlot()}
            </div>
            <button class="btn primary" type="button" id="add-line" style="height:40px">${icon('plus')}Add to Order</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Order items</h2><span class="summary-chips" id="summary"></span></div>
        <div id="server-error" style="padding:0 20px"></div>
        <div id="lines"></div>
        <div class="card-foot">
          <a class="btn" href="${editing ? `#/admin/orders/${state.purchase.id}` : '#/admin/orders'}">Cancel</a>
          <button class="btn primary lg" type="submit" id="submit-btn">${icon('check')}${editing ? 'Update order' : 'Place order'}</button>
        </div>
      </section>
    </form>`;

  const form = view.querySelector('#purchase-form');
  const select = view.querySelector('#new_item');
  const qtyInput = view.querySelector('#new_qty');

  const maxFor = (id) => {
    const item = state.items.get(id);
    if (!item) return 0;
    // inactive items in an existing order can be kept or reduced, never increased
    if (!item.active) return state.original.get(id) || 0;
    return item.stock_available + (state.original.get(id) || 0);
  };

  // ---------------------------------------------------- item dropdown
  function renderOptions() {
    const groups = new Map();
    [...state.items.values()]
      .filter((i) => i.active) // inactive items are never selectable
      .forEach((i) => {
        if (!groups.has(i.type_name)) groups.set(i.type_name, []);
        groups.get(i.type_name).push(i);
      });
    const keep = select.value;
    select.innerHTML =
      '<option value="">Select an item…</option>' +
      [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([type, list]) =>
            `<optgroup label="${esc(type)}">${list
              .map((i) => {
                const max = maxFor(i.id);
                const inOrder = state.lines.find((l) => l.item_id === i.id);
                const remaining = max - (inOrder ? inOrder.quantity : 0);
                const label = max <= 0 ? `${i.name} — out of stock` : `${i.name} — ${money(i.price)} — ${fmtNum(remaining)} available${inOrder ? ' (in order)' : ''}`;
                return `<option value="${i.id}" ${max <= 0 || remaining <= 0 ? 'disabled' : ''}>${esc(label)}</option>`;
              })
              .join('')}</optgroup>`
        )
        .join('');
    if (keep && select.querySelector(`option[value="${keep}"]:not([disabled])`)) select.value = keep;
  }

  // ---------------------------------------------------- lines table
  function rowCells(line) {
    const item = state.items.get(line.item_id);
    const max = maxFor(line.item_id);
    const qty = Number(line.quantity);
    const valid = Number.isInteger(qty) && qty > 0;
    const stockNow = item.stock_available;
    const original = state.original.get(line.item_id) || 0;
    const after = valid ? stockNow - (qty - original) : stockNow;
    return { item, max, qty, valid, after, original };
  }

  function renderLines() {
    const holder = view.querySelector('#lines');
    if (!state.lines.length) {
      holder.innerHTML = `<div class="empty">${icon('cart')}<h3>No items in this order yet</h3><p>Select an item and quantity above, then choose “Add to Order”.</p></div>`;
    } else {
      holder.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>#</th><th>Item</th><th>Type</th><th class="num">${editing ? 'Max Qty' : 'Available'}</th>
              ${editing ? '<th class="num">Original Qty</th>' : ''}
              <th class="num">Quantity</th>
              ${editing ? '<th class="num">Stock Change</th>' : ''}
              <th class="num">Stock After</th><th></th>
            </tr></thead>
            <tbody>
              ${state.lines
                .map((line, index) => {
                  const c = rowCells(line);
                  return `
                  <tr data-line="${index}" class="${c.item.active ? '' : 'row-inactive'}">
                    <td class="id">${index + 1}</td>
                    <td class="name">${esc(c.item.name)} ${c.item.active ? '' : '<span class="badge">Inactive</span>'}</td>
                    <td>${esc(c.item.type_name)}</td>
                    <td class="num">${fmtNum(c.max)}</td>
                    ${editing ? `<td class="num muted">${c.original ? fmtNum(c.original) : '<span class="badge blue plain">New</span>'}</td>` : ''}
                    <td class="num">
                      <input class="input num qty-input" type="number" min="1" max="${c.max}" step="1" inputmode="numeric"
                        value="${esc(line.quantity)}" data-qty="${index}" aria-label="Quantity for ${esc(c.item.name)}" />
                    </td>
                    ${editing ? `<td class="num" data-change="${index}">${signed(c.valid ? -(c.qty - c.original) : 0)}</td>` : ''}
                    <td class="num" data-after="${index}"><strong class="${c.after < 0 ? 'delta-neg' : ''}">${fmtNum(c.after)}</strong></td>
                    <td class="center">
                      <button class="btn sm icon" type="button" data-remove="${index}" title="Remove line" aria-label="Remove ${esc(c.item.name)}">${icon('x')}</button>
                    </td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>`;

      holder.querySelectorAll('[data-qty]').forEach((input) => {
        input.addEventListener('input', () => {
          const index = Number(input.dataset.qty);
          state.lines[index].quantity = input.value === '' ? '' : Number(input.value);
          const c = rowCells(state.lines[index]);
          holder.querySelector(`[data-after="${index}"]`).innerHTML = `<strong class="${c.after < 0 ? 'delta-neg' : ''}">${fmtNum(c.after)}</strong>`;
          const change = holder.querySelector(`[data-change="${index}"]`);
          if (change) change.innerHTML = signed(c.valid ? -(c.qty - c.original) : 0);
          input.classList.toggle('invalid', !c.valid || c.qty > c.max);
          holder.querySelector(`tr[data-line="${index}"]`).classList.remove('row-error');
          renderSummary();
        });
        input.addEventListener('change', renderOptions);
      });
      holder.querySelectorAll('[data-remove]').forEach((btn) =>
        btn.addEventListener('click', () => {
          state.lines.splice(Number(btn.dataset.remove), 1);
          view.querySelector('#server-error').innerHTML = '';
          renderLines();
          renderOptions();
        })
      );
    }
    renderSummary();
  }

  function renderSummary() {
    const units = state.lines.reduce((sum, l) => sum + (Number.isInteger(Number(l.quantity)) && Number(l.quantity) > 0 ? Number(l.quantity) : 0), 0);
    view.querySelector('#summary').innerHTML = `<span><strong>${state.lines.length}</strong> item${state.lines.length === 1 ? '' : 's'}</span><span><strong>${fmtNum(units)}</strong> units</span>`;
    view.querySelector('#submit-btn').disabled = state.lines.length === 0;
  }

  // ---------------------------------------------------- add line
  view.querySelector('#add-line').addEventListener('click', () => {
    const builder = view.querySelector('#builder');
    clearFieldErrors(builder);
    const id = Number(select.value);
    const qty = Number(qtyInput.value);
    if (!id) {
      setFieldError(builder, 'new_item', 'Select an item');
      select.focus();
      return;
    }
    if (qtyInput.value === '' || !Number.isInteger(qty)) {
      setFieldError(builder, 'new_qty', 'Enter a whole number');
      qtyInput.focus();
      return;
    }
    if (qty <= 0) {
      setFieldError(builder, 'new_qty', 'Quantity must be greater than zero');
      qtyInput.focus();
      return;
    }
    const item = state.items.get(id);
    const existing = state.lines.find((l) => l.item_id === id);
    const total = qty + (existing ? Number(existing.quantity) || 0 : 0);
    const max = maxFor(id);
    if (total > max) {
      setFieldError(builder, 'new_qty', `Only ${fmtNum(max - (existing ? Number(existing.quantity) || 0 : 0))} available`);
      qtyInput.focus();
      return;
    }
    if (existing) {
      existing.quantity = total;
      toast(`${item.name}: quantity updated to ${total}`, 'info', { timeout: 2600 });
    } else {
      state.lines.push({ item_id: id, quantity: qty });
    }
    view.querySelector('#server-error').innerHTML = '';
    select.value = '';
    qtyInput.value = 1;
    renderLines();
    renderOptions();
    select.focus();
  });
  qtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      view.querySelector('#add-line').click();
    }
  });

  // ---------------------------------------------------- submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const serverError = view.querySelector('#server-error');
    serverError.innerHTML = '';
    view.querySelectorAll('tr.row-error').forEach((tr) => tr.classList.remove('row-error'));

    // client-side checks (the backend repeats every one of them)
    const problems = [];
    if (!form.purchase_date.value) problems.push({ field: 'purchase_date', message: 'Purchase date is required' });
    if (!state.lines.length) problems.push({ field: 'items', message: 'Purchase must contain at least one item' });
    state.lines.forEach((line, index) => {
      const c = rowCells(line);
      if (!c.valid) problems.push({ line: index, message: `${c.item.name}: quantity must be greater than zero` });
      else if (c.qty > c.max)
        problems.push({
          line: index,
          message: c.item.active
            ? `${c.item.name}: insufficient stock — requested ${c.qty}, maximum ${c.max}`
            : `${c.item.name}: item is inactive — quantity can only be kept or reduced (max ${c.max})`,
        });
    });
    if (problems.length) {
      showProblems({ message: problems.length === 1 ? problems[0].message : `${problems.length} problems found`, details: problems });
      return;
    }

    const payload = {
      purchase_date: form.purchase_date.value,
      remarks: form.remarks.value.trim(),
      items: state.lines.map((l) => ({ item_id: l.item_id, quantity: Number(l.quantity) })),
    };
    if (!editing && form.order_id.value.trim()) payload.order_id = form.order_id.value.trim();

    const button = view.querySelector('#submit-btn');
    setLoading(button, true);
    try {
      const res = editing
        ? await api.purchases.update(state.purchase.id, payload)
        : await api.purchases.create(payload);
      if (editing) flash.purchaseAdjustments = res.data.stock_adjustments || null;
      toast(res.message);
      navigate(`#/admin/orders/${res.data.id}`);
    } catch (error) {
      showProblems(error);
      // refresh stock figures so the user sees the latest availability
      try {
        const fresh = await api.items.list({ sort: 'name' });
        fresh.data.forEach((i) => state.items.set(i.id, i));
        renderLines();
        renderOptions();
        markRows(error);
      } catch (ignored) {
        /* keep current view */
      }
    } finally {
      setLoading(button, false);
    }
  });

  function markRows(error) {
    (error.details || []).forEach((d) => {
      if (d.line !== undefined && d.line !== null) {
        const tr = view.querySelector(`tr[data-line="${d.line}"]`);
        if (tr) tr.classList.add('row-error');
      }
    });
  }

  function showProblems(error) {
    const fieldOnly = (error.details || []).filter((d) => d.field && !String(d.field).startsWith('items'));
    applyFieldErrors(form, { details: fieldOnly });
    view.querySelector('#server-error').innerHTML = `<div style="margin:16px 0 0">${errorNotice(error, 'Purchase not saved')}</div>`;
    markRows(error);
    view.querySelector('#server-error').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  renderOptions();
  renderLines();
}

