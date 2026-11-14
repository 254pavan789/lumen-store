import { api } from '../../api.js';
import {
  applyFieldErrors, clearFieldErrors, confirmDialog, emptyState, esc, fieldErrorSlot, fmtDate, icon, pageHead,
  setLoading, skeletonRows, toast, toastError,
} from '../../ui.js';

export async function render(view, params, ctx) {
  view.innerHTML =
    pageHead({
      title: 'Categories',
      subtitle: 'Item types such as Electronics, Furniture, Clothing, Grocery and Stationery. Shoppers browse the store by these.',
    }) +
    `
    <section class="card">
      <div class="card-head"><h2>Add item type</h2></div>
      <form class="card-body" id="type-form" novalidate>
        <div class="line-builder" style="grid-template-columns:minmax(0,1fr) auto">
          <div class="field" data-field="type_name">
            <label for="type_name">Type name <span class="req">*</span></label>
            <input id="type_name" name="type_name" class="input" maxlength="50" placeholder="e.g. Electronics" autocomplete="off" />
            ${fieldErrorSlot()}
          </div>
          <button class="btn primary" type="submit" style="height:40px">${icon('plus')}Add Type</button>
        </div>
      </form>
    </section>
    <section class="card">
      <div class="card-head"><h2>All item types</h2><span class="hint" id="type-count"></span></div>
      <div id="type-table">${skeletonRows(4)}</div>
    </section>`;

  const form = view.querySelector('#type-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const input = form.type_name;
    const name = input.value.trim();
    if (!name) {
      applyFieldErrors(form, { details: [{ field: 'type_name', message: 'Item type name is required' }] });
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      const res = await api.itemTypes.create({ type_name: name });
      toast(res.message);
      input.value = '';
      await loadTable(view, ctx);
    } catch (error) {
      const unmatched = applyFieldErrors(form, error);
      if (!error.details.length || unmatched.length) toastError(error);
    } finally {
      setLoading(btn, false);
    }
  });

  await loadTable(view, ctx);
}

async function loadTable(view, ctx) {
  const { data } = await api.itemTypes.list();
  if (!ctx.isCurrent()) return;
  const holder = view.querySelector('#type-table');
  view.querySelector('#type-count').textContent = `${data.length} type${data.length === 1 ? '' : 's'}`;

  if (!data.length) {
    holder.innerHTML = emptyState({ iconName: 'tag', title: 'No item types yet', text: 'Add your first category above.' });
    return;
  }

  holder.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>ID</th><th>Category (Item Type)</th><th class="num">Products</th><th class="num">Active</th><th>Created</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${data
            .map(
              (t) => `
            <tr>
              <td class="id">#${t.id}</td>
              <td class="name"><a href="#/admin/products" data-filter-type="${t.id}">${esc(t.type_name)}</a></td>
              <td class="num">${t.item_count}</td>
              <td class="num">${t.active_item_count}</td>
              <td class="muted">${fmtDate(t.created_at)}</td>
              <td>
                <div class="actions">
                  <button class="btn sm" data-rename="${t.id}" data-name="${esc(t.type_name)}">${icon('edit')}Rename</button>
                  <button class="btn sm danger" data-delete="${t.id}" data-name="${esc(t.type_name)}" ${
                    t.can_delete ? '' : `disabled title="Used by ${t.item_count} item(s) — cannot be deleted"`
                  }>${icon('trash')}Delete</button>
                </div>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;

  holder.querySelectorAll('[data-filter-type]').forEach((a) =>
    a.addEventListener('click', () => sessionStorage.setItem('items.type', a.dataset.filterType))
  );

  holder.querySelectorAll('[data-rename]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const result = await confirmDialog({
        title: 'Rename item type',
        message: 'Items in this category keep their link; only the name changes.',
        confirmText: 'Save',
        iconName: 'edit',
        input: { label: 'Type name', value: btn.dataset.name, required: true, maxLength: 50 },
      });
      if (!result) return;
      try {
        const res = await api.itemTypes.update(btn.dataset.rename, { type_name: result.value });
        toast(res.message);
        await loadTable(view, ctx);
      } catch (error) {
        toastError(error);
      }
    })
  );

  holder.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete “${btn.dataset.name}”?`,
        message: 'This item type will be permanently removed.',
        confirmText: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        const res = await api.itemTypes.remove(btn.dataset.delete);
        toast(res.message);
        await loadTable(view, ctx);
      } catch (error) {
        toastError(error);
      }
    })
  );
}
