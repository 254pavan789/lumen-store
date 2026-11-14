import { api } from '../../api.js';
import { flash, navigate } from '../../state.js';
import { esc, icon, money, setLoading, toast } from '../../ui.js';
import { productThumb } from '../art.js';
import { getProduct, invalidateCatalog, loadCatalog, searchProducts, getProducts } from '../catalog.js';

/**
 * Modify an existing order. Quantities can go up (if stock allows), down, or to
 * zero (line removed); new products can be added. The server adjusts stock by
 * the difference and re-validates everything.
 */
export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="skeleton" style="height:56px;width:40%;margin-top:28px"></div>
    <div class="checkout"><div class="skeleton" style="height:420px;border-radius:24px"></div><div class="skeleton" style="height:280px;border-radius:24px"></div></div></div>`;
  const [{ data: o }] = await Promise.all([api.purchases.get(params.id), loadCatalog({ force: true })]);
  if (!ctx.isCurrent()) return;

  if (o.status !== 'COMPLETED') {
    view.innerHTML = `<div class="container"><div class="empty" style="padding-top:96px">${icon('ban')}<h3>This order can’t be modified</h3>
      <p>Cancelled orders are kept for history only.</p><a class="btn primary" href="#/orders/${o.id}">Back to order</a></div></div>`;
    return;
  }

  // working state
  const original = new Map(o.items.map((l) => [l.item_id, l.quantity]));
  const lines = o.items.map((l) => ({
    id: l.item_id,
    qty: l.quantity,
    name: l.item_name,
    type: l.type_name,
    price: l.unit_price,
    active: l.item_active,
    isNew: false,
  }));

  const maxFor = (line) => {
    const p = getProduct(line.id);
    const orig = original.get(line.id) || 0;
    if (!line.active || !p) return orig; // inactive: keep or reduce only
    return p.stock_available + orig;
  };

  view.innerHTML = `
    <div class="container">
      <div class="page-title">
        <div class="crumbs"><a href="#/orders">Orders</a>${icon('chev-right')}<a href="#/orders/${o.id}">${esc(o.order_id)}</a>${icon('chev-right')}<span>Modify</span></div>
        <h1>Modify <span class="order-id">${esc(o.order_id)}</span></h1>
        <p>Change quantities, remove products or add new ones. Stock is adjusted only by the difference.</p>
      </div>
      <div id="e-alert"></div>
      <div class="checkout">
        <div>
          <section class="panel">
            <div class="panel-head"><h2>Items in this order</h2><span class="hint" id="e-count"></span></div>
            <div class="panel-body" id="e-lines"></div>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Add more products</h2></div>
            <div class="panel-body pad picker">
              <div class="s-search" style="max-width:none;margin:0">${icon('search')}<input class="input" id="e-search" type="search" placeholder="Search products to add…" autocomplete="off" aria-label="Search products to add"/></div>
              <div class="picker-results" id="e-results"></div>
            </div>
          </section>
        </div>
        <aside class="summary">
          <section class="panel">
            <div class="panel-head"><h2>New total</h2></div>
            <div class="panel-body" id="e-summary"></div>
          </section>
        </aside>
      </div>
    </div>`;

  const paint = () => {
    const live = lines.filter((l) => l.qty > 0);
    const units = live.reduce((s, l) => s + l.qty, 0);
    view.querySelector('#e-count').textContent = `${units} unit${units === 1 ? '' : 's'}`;
    view.querySelector('#e-lines').innerHTML = lines
      .map((l, i) => {
        const max = maxFor(l);
        const orig = original.get(l.id) || 0;
        const diff = l.qty - orig;
        const chg =
          diff === 0
            ? '<span class="muted">No change</span>'
            : diff > 0
              ? `<span class="delta-neg">${diff} more from stock</span>`
              : `<span class="delta-pos">${-diff} back to stock</span>`;
        return `
          <div class="cline ${l.qty === 0 ? 'removing-soft' : ''}" style="${l.qty === 0 ? 'opacity:.55' : ''}">
            ${productThumb({ name: l.name, type_name: l.type }, 76)}
            <div class="info">
              <b>${esc(l.name)} ${l.isNew ? '<span class="badge blue plain">New</span>' : ''} ${!l.active ? '<span class="badge plain">No longer sold</span>' : ''}</b>
              <small>${money(l.price)} each · max ${max}</small>
              <span class="chg" style="font-size:.8rem;font-weight:600">${l.qty === 0 ? '<span class="delta-pos">Removed — all returned to stock</span>' : chg}</span>
            </div>
            <div class="right">
              <b class="tabular">${money(l.price * l.qty)}</b>
              <div class="stepper light" role="group" aria-label="Quantity of ${esc(l.name)}">
                <button type="button" data-e="-1" data-i="${i}" ${l.qty <= 0 ? 'disabled' : ''} aria-label="Decrease">${icon(l.qty === 1 ? 'trash' : 'minus')}</button>
                <output>${l.qty}</output>
                <button type="button" data-e="1" data-i="${i}" ${l.qty >= max ? 'disabled' : ''} aria-label="Increase">${icon('plus')}</button>
              </div>
            </div>
          </div>`;
      })
      .join('');

    const oldTotal = o.total_amount;
    const newTotal = live.reduce((s, l) => s + l.qty * l.price, 0);
    const delta = newTotal - oldTotal;
    const dirty = lines.some((l) => l.qty !== (original.get(l.id) || 0));
    view.querySelector('#e-summary').innerHTML = `
      <div class="sum-row"><span>Original total</span><b>${money(oldTotal)}</b></div>
      <div class="sum-row"><span>Difference</span><b class="${delta > 0 ? 'delta-neg' : delta < 0 ? 'delta-pos' : ''}">${delta > 0 ? '+' : delta < 0 ? '−' : ''}${money(Math.abs(delta))}</b></div>
      <div class="sum-row total"><span>New total</span><b>${money(newTotal)}</b></div>
      <button class="btn primary xl block" id="e-save" style="margin-top:18px" ${!dirty || !live.length ? 'disabled' : ''}>${icon('check')}Save changes</button>
      ${!live.length ? '<div class="notice warn" style="margin-top:12px">' + icon('alert') + '<div>An order needs at least one item. To drop everything, cancel the order instead.</div></div>' : ''}
      <a class="btn ghost block" href="#/orders/${o.id}" style="margin-top:6px">Discard changes</a>`;
    view.querySelector('#e-save').addEventListener('click', save);
  };

  const paintResults = () => {
    const q = view.querySelector('#e-search').value.trim();
    const pool = (q ? searchProducts(q, 12) : getProducts().slice(0, 6)).filter((p) => p.stock_available > 0 && !lines.some((l) => l.id === p.id && l.qty > 0));
    view.querySelector('#e-results').innerHTML = pool.length
      ? pool
          .map(
            (p) => `<div class="picker-row">${productThumb(p, 44)}<div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</b><small class="muted">${p.stock_available} in stock</small></div>
              <span class="price" style="font-size:.95rem">${money(p.price)}</span><button class="btn sm primary" type="button" data-add="${p.id}">${icon('plus')}Add</button></div>`
          )
          .join('')
      : `<div class="muted" style="padding:12px 4px">${q ? 'No matching products in stock.' : 'All suggested products are already in this order.'}</div>`;
  };

  view.addEventListener('click', (e) => {
    const step = e.target.closest('[data-e]');
    if (step) {
      const line = lines[Number(step.dataset.i)];
      line.qty = Math.max(0, Math.min(line.qty + Number(step.dataset.e), maxFor(line)));
      if (line.qty === 0 && line.isNew) lines.splice(Number(step.dataset.i), 1);
      paint();
      paintResults();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const p = getProduct(add.dataset.add);
      const existing = lines.find((l) => l.id === p.id);
      if (existing) existing.qty = 1;
      else lines.push({ id: p.id, qty: 1, name: p.name, type: p.type_name, price: p.price, active: true, isNew: !original.has(p.id) });
      paint();
      paintResults();
      toast(`${p.name} added to the order`, 'info', { timeout: 2000 });
    }
  });
  view.querySelector('#e-search').addEventListener('input', paintResults);

  async function save() {
    const btn = view.querySelector('#e-save');
    setLoading(btn, true);
    try {
      const res = await api.purchases.update(o.id, {
        purchase_date: o.purchase_date,
        remarks: o.remarks || '',
        items: lines.filter((l) => l.qty > 0).map((l) => ({ item_id: l.id, quantity: l.qty })),
      });
      flash.purchaseAdjustments = res.data.stock_adjustments;
      invalidateCatalog();
      toast(res.message);
      navigate(`#/orders/${o.id}`);
    } catch (error) {
      setLoading(btn, false);
      await loadCatalog({ force: true }).catch(() => {});
      const details = (error.details || []).map((d) => `<li>${esc(d.message)}</li>`).join('');
      view.querySelector('#e-alert').innerHTML = `<div class="notice error" style="margin-top:18px" role="alert">${icon('alert')}<div><strong>${esc(error.message)}</strong>${details && error.details.length > 1 ? `<ul>${details}</ul>` : ''}<div style="margin-top:6px">Stock was refreshed — maximum quantities below are up to date.</div></div></div>`;
      lines.forEach((l) => (l.qty = Math.min(l.qty, maxFor(l))));
      paint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  paint();
  paintResults();
}
