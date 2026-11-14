/** Quick view: product essentials + add to cart without leaving the page. */
import { esc, icon, money, toast } from '../ui.js';
import { productArt } from './art.js';
import { cart } from './cart.js';
import { getProduct } from './catalog.js';
import { stockInfo } from './components.js';
import { flyToCart } from './motion.js';
import { openOverlay } from './overlay.js';
import { openCart } from './shell.js';

export function openQuickView(p) {
  let qty = 1;
  const s = stockInfo(p);
  const room = () => Math.max(0, p.stock_available - cart.qty(p.id));
  const pct = Math.min(100, (p.stock_available / Math.max(20, p.stock_available)) * 100);

  const { panel, close } = openOverlay(
    `<button class="icon-btn qv-close" data-close aria-label="Close quick view">${icon('x')}</button>
     <div class="qv">
       <div class="qv-art" data-fly-src>${productArt(p, { soldOut: s.tone === 'out' })}</div>
       <div class="qv-info">
         <span class="kicker">${esc(p.type_name)}</span>
         <h2>${esc(p.name)}</h2>
         <div class="price">${money(p.price)}</div>
         ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
         <div class="meter compact">
           <div class="top"><span>${s.tone === 'out' ? 'Sold out' : s.tone === 'low' ? `Only ${p.stock_available} left` : 'In stock'}</span><span class="tabular">${p.stock_available} available</span></div>
           <div class="bar"><i class="${s.tone}" style="width:${pct}%"></i></div>
         </div>
         <div class="qv-buy" id="qv-buy"></div>
         <a class="link-arrow" href="#/product/${p.id}" data-close>View full details ${icon('arrow-right')}</a>
       </div>
     </div>`,
    { variant: 'modal', label: `${p.name} quick view` }
  );

  const paint = () => {
    const r = room();
    qty = Math.min(Math.max(1, qty), Math.max(1, r));
    const buy = panel.querySelector('#qv-buy');
    if (s.tone === 'out') {
      buy.innerHTML = '<button class="btn lg block" disabled>Sold out</button>';
      return;
    }
    buy.innerHTML = `
      <div class="stepper light lg" role="group" aria-label="Quantity">
        <button type="button" data-q="-1" aria-label="Decrease" ${qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
        <output>${qty}</output>
        <button type="button" data-q="1" aria-label="Increase" ${qty >= r ? 'disabled' : ''}>${icon('plus')}</button>
      </div>
      <button class="btn primary xl" id="qv-add" data-autofocus ${r <= 0 ? 'disabled' : ''}>${icon('bag')}${r <= 0 ? 'All stock in cart' : 'Add to cart'}</button>`;
  };
  paint();

  panel.addEventListener('click', (e) => {
    const step = e.target.closest('[data-q]');
    if (step) {
      qty += Number(step.dataset.q);
      paint();
      return;
    }
    if (e.target.closest('#qv-add')) {
      const live = getProduct(p.id) || p;
      const before = cart.qty(p.id);
      const after = cart.add(p.id, qty, live.stock_available);
      if (after === before) return;
      flyToCart(panel.querySelector('[data-fly-src]'));
      toast(`Added ${after - before} × ${p.name}`, 'success', { action: { label: 'View cart', onClick: openCart } });
      setTimeout(close, 180);
    }
  });
}
