import { api } from '../../api.js';
import { navigate } from '../../state.js';
import { esc, fmtDate, icon, money, toast } from '../../ui.js';
import { productArt } from '../art.js';
import { cart } from '../cart.js';
import { getProduct, getProducts, loadCatalog } from '../catalog.js';
import { rail, railNav, recentProducts, recordRecent, saveButton, stockInfo } from '../components.js';
import { flyToCart } from '../motion.js';
import { openCart } from '../shell.js';

export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="pdp"><div class="skeleton" style="aspect-ratio:1;border-radius:32px"></div>
    <div><div class="skeleton" style="height:48px;width:70%;margin-top:20px"></div><div class="skeleton" style="height:28px;width:30%;margin-top:20px"></div>
    <div class="skeleton" style="height:120px;margin-top:24px"></div></div></div></div>`;
  await loadCatalog();
  if (!ctx.isCurrent()) return;

  let p = getProduct(params.id);
  if (!p) {
    // not in the active catalogue: inactive or deleted
    let item = null;
    try {
      item = (await api.items.get(params.id)).data;
    } catch (e) {
      item = null;
    }
    if (!ctx.isCurrent()) return;
    view.innerHTML = `
      <div class="container"><div class="pdp">
        <div class="pdp-media">${item ? productArt(item, { soldOut: true }) : ''}</div>
        <div class="pdp-info">
          <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<a href="#/shop">Shop</a></div>
          <h1>${item ? esc(item.name) : 'Product not found'}</h1>
          <div class="notice warn">${icon('ban')}<div><strong>${item ? 'This product is no longer available.' : 'We couldn’t find this product.'}</strong><br>
          ${item ? 'It has been retired from the store but stays in past order history.' : 'It may have been removed.'}</div></div>
          <div><a class="btn primary lg" href="#/shop">Browse products ${icon('arrow-right')}</a></div>
        </div>
      </div></div>`;
    return;
  }

  recordRecent(p.id);
  let qty = 1;
  let first = true;
  const draw = () => {
    p = getProduct(params.id) || p;
    const s = stockInfo(p);
    const inCart = cart.qty(p.id);
    const room = Math.max(0, p.stock_available - inCart);
    qty = Math.min(Math.max(1, qty), Math.max(1, room));
    const pct = Math.min(100, (p.stock_available / Math.max(20, p.stock_available)) * 100);
    const related = getProducts().filter((x) => x.item_type_id === p.item_type_id && x.id !== p.id);
    const recent = recentProducts(p.id).slice(0, 10);

    view.innerHTML = `
      <div class="container">
        <div class="pdp">
          <div class="pdp-media" data-fly-src>
            ${productArt(p, { soldOut: s.tone === 'out' })}
            <div class="flags">${s.badge ? `<span class="badge ${s.badgeCls} plain lg">${esc(s.badge)}</span>` : ''}${p.units_sold > 0 ? `<span class="badge plain lg" style="background:rgba(255,255,255,.86);color:#0f0f12">${p.units_sold} sold</span>` : ''}</div>
            ${saveButton(p)}
          </div>
          <div class="pdp-info ${first ? 'enter-stagger' : ''}">
            <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<a href="#/shop">Shop</a>${icon('chev-right')}<a href="#/shop?cat=${p.item_type_id}">${esc(p.type_name)}</a></div>
            <h1>${esc(p.name)}</h1>
            <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
              <span class="price">${money(p.price)}</span>
              <span class="muted" style="font-size:.88rem">Inclusive of all taxes · Free delivery</span>
            </div>
            ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
            <div class="meter">
              <div class="top"><span>${s.tone === 'out' ? 'Currently sold out' : s.tone === 'low' ? `Hurry — only ${p.stock_available} left` : 'In stock and ready to ship'}</span><span class="tabular">${p.stock_available} available</span></div>
              <div class="bar"><i class="${s.tone}" style="width:${pct}%"></i></div>
              <small>${inCart ? `${inCart} already in your cart · ` : ''}Stock is reserved the moment you place your order.</small>
            </div>
            ${
              s.tone === 'out'
                ? `<div class="buy-row"><button class="btn lg block" disabled>Sold out</button></div>
                   <a class="btn outline lg" href="#/shop?cat=${p.item_type_id}">See similar products</a>`
                : `<div class="buy-row">
                    <div class="stepper light lg" role="group" aria-label="Quantity to add">
                      <button type="button" data-q="-1" aria-label="Decrease quantity" ${qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
                      <output aria-live="polite">${qty}</output>
                      <button type="button" data-q="1" aria-label="Increase quantity" ${qty >= room ? 'disabled' : ''}>${icon('plus')}</button>
                    </div>
                    <button class="btn primary xl" id="add" ${room <= 0 ? 'disabled' : ''}>${icon('bag')}${room <= 0 ? 'All stock in cart' : 'Add to cart'}</button>
                  </div>
                  <button class="btn brand xl block" id="buy">${icon('zap')}Buy now</button>`
            }
            <div class="perks">
              <div class="perk">${icon('truck')}<div><b>Free delivery</b><small>On every order, no minimum.</small></div></div>
              <div class="perk">${icon('repeat')}<div><b>Edit your order anytime</b><small>Change quantities or add items after checkout.</small></div></div>
              <div class="perk">${icon('shield')}<div><b>Cancel with one tap</b><small>Stock is returned instantly; your history is kept.</small></div></div>
            </div>
            <dl class="specs">
              <div><dt>Category</dt><dd>${esc(p.type_name)}</dd></div>
              <div><dt>Product ID</dt><dd>#${p.id}</dd></div>
              <div><dt>Listed on</dt><dd>${fmtDate(p.purchase_date)}</dd></div>
              <div><dt>Availability</dt><dd>${esc(s.tone === 'out' ? 'Sold out' : s.tone === 'low' ? 'Low stock' : 'In stock')}</dd></div>
            </dl>
          </div>
        </div>
        ${
          related.length
            ? `<section class="section"><div class="sec-head"><div><h2>More in ${esc(p.type_name)}</h2></div>${railNav('rail-related')}</div>${rail('rail-related', related)}</section>`
            : ''
        }
        ${
          recent.length
            ? `<section class="section"><div class="sec-head"><div><h2>Recently viewed</h2></div>${railNav('rail-recent')}</div>${rail('rail-recent', recent)}</section>`
            : ''
        }
      </div>
      ${
        s.tone === 'out'
          ? ''
          : `<div class="buy-bar" role="region" aria-label="Quick add">
              <div class="bb-info"><b>${esc(p.name)}</b><span class="price">${money(p.price)}</span></div>
              <button class="btn primary lg" id="bb-add" ${room <= 0 ? 'disabled' : ''}>${icon('bag')}${room <= 0 ? 'In cart' : inCart ? `Add · ${inCart} in cart` : 'Add to cart'}</button>
            </div>`
      }`;

    first = false;
    const stepper = view.querySelector('.buy-row .stepper');
    if (stepper) {
      stepper.addEventListener('click', (e) => {
        const b = e.target.closest('[data-q]');
        if (!b) return;
        qty = Math.min(Math.max(1, qty + Number(b.dataset.q)), Math.max(1, room));
        stepper.querySelector('output').textContent = qty;
        stepper.querySelector('[data-q="-1"]').disabled = qty <= 1;
        stepper.querySelector('[data-q="1"]').disabled = qty >= room;
      });
    }
    const doAdd = () => {
      const before = cart.qty(p.id);
      const after = cart.add(p.id, qty, p.stock_available);
      if (after === before) return;
      flyToCart(view.querySelector('[data-fly-src]'));
      toast(`Added ${after - before} × ${p.name}`, 'success', { action: { label: 'View cart', onClick: openCart } });
      qty = 1;
      setTimeout(draw, 40);
    };
    const add = view.querySelector('#add');
    if (add) add.addEventListener('click', doAdd);
    const bbAdd = view.querySelector('#bb-add');
    if (bbAdd) bbAdd.addEventListener('click', doAdd);
    const buy = view.querySelector('#buy');
    if (buy) {
      buy.addEventListener('click', () => {
        // make sure at least the selected quantity is in the cart, then go straight to checkout
        if (cart.qty(p.id) < qty) cart.set(p.id, qty, p.stock_available);
        navigate('#/checkout');
      });
    }
  };

  draw();
}
