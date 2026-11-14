import { api } from '../../api.js';
import { navigate } from '../../state.js';
import { applyFieldErrors, clearFieldErrors, esc, fieldErrorSlot, icon, money, setLoading, todayISO } from '../../ui.js';
import { productThumb } from '../art.js';
import { cart } from '../cart.js';
import { getProduct, invalidateCatalog, loadCatalog } from '../catalog.js';
import { cartControl } from '../components.js';
import { cartTotals } from '../shell.js';

export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="skeleton" style="height:56px;width:30%;margin-top:28px"></div>
    <div class="checkout"><div class="skeleton" style="height:420px;border-radius:24px"></div><div class="skeleton" style="height:320px;border-radius:24px"></div></div></div>`;

  const before = cart.lines();
  await loadCatalog({ force: true }); // freshest stock before ordering
  if (!ctx.isCurrent()) return;
  const after = cart.lines();
  const adjusted = before.filter((b) => {
    const a = after.find((x) => x.id === b.id);
    return !a || a.qty !== b.qty;
  });

  let nextOrder = '';
  try {
    nextOrder = (await api.purchases.nextOrderId()).data.order_id;
  } catch (e) {
    nextOrder = '';
  }
  if (!ctx.isCurrent()) return;

  if (!cart.count()) {
    view.innerHTML = `<div class="container"><div class="empty" style="padding-top:96px">${icon('bag')}
      <h3>Your cart is empty</h3><p>Add a few products and come back to check out.</p>
      <a class="btn primary lg" href="#/shop">Browse products</a></div></div>`;
    return;
  }

  view.innerHTML = `
    <div class="container">
      <div class="page-title">
        <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<span>Checkout</span></div>
        <h1>Checkout</h1>
      </div>
      <form class="checkout" id="co-form" novalidate>
        <div>
          <div id="co-alert">${
            adjusted.length
              ? `<div class="notice warn" style="margin-bottom:18px">${icon('alert')}<div><strong>We updated your cart to match live stock.</strong><ul>${adjusted
                  .map((b) => {
                    const p = getProduct(b.id);
                    const a = after.find((x) => x.id === b.id);
                    return `<li>${esc(p ? p.name : 'An item')}: ${a ? `now ${a.qty} (was ${b.qty})` : 'sold out — removed'}</li>`;
                  })
                  .join('')}</ul></div></div>`
              : ''
          }</div>
          <section class="panel">
            <div class="panel-head"><span class="step">1</span><h2>Review your items</h2><span class="hint" id="co-count"></span></div>
            <div class="panel-body" id="co-lines"></div>
          </section>
          <section class="panel">
            <div class="panel-head"><span class="step">2</span><h2>Order details</h2></div>
            <div class="panel-body pad">
              <div class="form-grid">
                <div class="field" data-field="purchase_date">
                  <label for="co-date">Order date <span class="req">*</span></label>
                  <input class="input" type="date" id="co-date" value="${todayISO()}" required />
                  ${fieldErrorSlot()}
                </div>
                <div class="field">
                  <label>Order number</label>
                  <input class="input mono" value="${esc(nextOrder || 'Assigned automatically')}" readonly />
                  <span class="help">Assigned when you place the order.</span>
                </div>
                <div class="field full" data-field="remarks">
                  <label for="co-note">Delivery note <span class="help" style="font-weight:500">(optional)</span></label>
                  <textarea class="input" id="co-note" maxlength="255" placeholder="e.g. Leave at the reception desk"></textarea>
                  ${fieldErrorSlot()}
                </div>
              </div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-head"><span class="step">3</span><h2>Payment</h2></div>
            <div class="panel-body pad">
              <div class="notice">${icon('shield')}<div><strong>Pay on delivery</strong><br>No card details needed. Pay by cash or UPI when your order arrives.</div></div>
            </div>
          </section>
        </div>
        <aside class="summary">
          <section class="panel">
            <div class="panel-head"><h2>Order summary</h2></div>
            <div class="panel-body" id="co-summary"></div>
          </section>
        </aside>
      </form>
    </div>`;

  const paint = () => {
    const { lines, subtotal, units } = cartTotals();
    if (!lines.length) {
      navigate('#/checkout');
      return;
    }
    view.querySelector('#co-count').textContent = `${units} item${units === 1 ? '' : 's'}`;
    view.querySelector('#co-lines').innerHTML = lines
      .map(
        ({ p, qty }) => `
        <div class="cline" data-line="${p.id}">
          <a href="#/product/${p.id}">${productThumb(p, 76)}</a>
          <div class="info">
            <b>${esc(p.name)}</b>
            <small>${esc(p.type_name)} · ${money(p.price)} each</small>
            <span class="warn" data-warn="${p.id}">${p.stock_available <= 5 ? `Only ${p.stock_available} left` : ''}</span>
          </div>
          <div class="right"><b class="tabular">${money(p.price * qty)}</b>${cartControl(p)}</div>
        </div>`
      )
      .join('');
    view.querySelector('#co-summary').innerHTML = `
      <div class="thumbs">${lines.slice(0, 6).map(({ p }) => productThumb(p, 44)).join('')}</div>
      <div class="sum-row"><span>Items (${units})</span><b>${money(subtotal)}</b></div>
      <div class="sum-row"><span>Delivery</span><b style="color:var(--green)">Free</b></div>
      <div class="sum-row"><span>Payment</span><b>On delivery</b></div>
      <div class="sum-row total"><span>Total</span><b>${money(subtotal)}</b></div>
      <button class="btn primary xl block" type="submit" id="place" style="margin-top:18px">${icon('check')}Place order · ${money(subtotal)}</button>
      <div class="secure">${icon('lock')}Stock is verified on our server when you order</div>`;
    let bar = view.querySelector('.co-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'buy-bar co-bar';
      view.appendChild(bar);
    }
    bar.innerHTML = `<div class="bb-info"><b>Total · ${units} item${units === 1 ? '' : 's'}</b><span class="price">${money(subtotal)}</span></div>
      <button class="btn primary lg" type="button" id="bar-place">${icon('check')}Place order</button>`;
    bar.querySelector('#bar-place').addEventListener('click', () => view.querySelector('#place').click());
  };

  paint();
  const unsub = cart.subscribe(() => {
    if (!document.body.contains(view.querySelector('#co-lines'))) {
      unsub();
      return;
    }
    paint();
  });

  const form = view.querySelector('#co-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const date = view.querySelector('#co-date').value;
    if (!date) {
      applyFieldErrors(form, { details: [{ field: 'purchase_date', message: 'Choose an order date' }] });
      return;
    }
    const { lines } = cartTotals();
    const btn = view.querySelector('#place');
    setLoading(btn, true);
    try {
      const res = await api.purchases.create({
        purchase_date: date,
        remarks: view.querySelector('#co-note').value.trim(),
        items: lines.map((l) => ({ item_id: l.id, quantity: l.qty })),
      });
      unsub();
      cart.clear();
      invalidateCatalog();
      navigate(`#/order-placed/${res.data.id}`);
    } catch (error) {
      setLoading(btn, false);
      await loadCatalog({ force: true }).catch(() => {});
      const details = error.details || [];
      const fixable = details.filter((d) => d.item_id && d.available !== undefined);
      view.querySelector('#co-alert').innerHTML = `
        <div class="notice error" style="margin-bottom:18px" role="alert">${icon('alert')}<div>
          <strong>${esc(error.message)}</strong>
          ${details.length > 1 ? `<ul>${details.map((d) => `<li>${esc(d.message)}</li>`).join('')}</ul>` : ''}
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            ${fixable.length ? '<button type="button" class="btn sm primary" id="fix">Use available quantities</button>' : ''}
          </div>
        </div></div>`;
      applyFieldErrors(form, { details: details.filter((d) => d.field && !String(d.field).startsWith('items')) });
      paint();
      details.forEach((d) => {
        const row = view.querySelector(`[data-line="${d.item_id}"]`);
        if (row) {
          row.classList.add('error');
          const w = row.querySelector('[data-warn]');
          if (w) w.textContent = d.available !== undefined ? `Only ${d.available} available` : d.message;
        }
      });
      const fix = view.querySelector('#fix');
      if (fix) {
        fix.addEventListener('click', () => {
          fixable.forEach((d) => (d.available > 0 ? cart.set(d.item_id, d.available, d.available) : cart.remove(d.item_id)));
          view.querySelector('#co-alert').innerHTML = `<div class="notice success" style="margin-bottom:18px">${icon('check-circle')}<div>Quantities updated to what’s in stock. Review and place your order.</div></div>`;
        });
      }
      view.querySelector('#co-alert').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}
