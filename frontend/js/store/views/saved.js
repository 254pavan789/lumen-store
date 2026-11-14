import { icon } from '../../ui.js';
import { saved } from '../cart.js';
import { getProduct, loadCatalog } from '../catalog.js';
import { productGrid } from '../components.js';
import { staggerIn } from '../motion.js';

export async function render(view, params, ctx) {
  await loadCatalog();
  if (!ctx.isCurrent()) return;

  const draw = () => {
    const items = saved.ids().map(getProduct).filter(Boolean);
    view.innerHTML = `
      <div class="container">
        <div class="page-title">
          <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<span>Saved</span></div>
          <h1>Saved for later</h1>
          <p>${items.length ? `${items.length} product${items.length === 1 ? '' : 's'} you love. Stock is live — add them before they’re gone.` : ''}</p>
        </div>
        ${
          items.length
            ? `<div class="grid-products" id="saved-grid" style="margin-top:20px">${productGrid(items)}</div>`
            : `<div class="empty">${icon('heart')}<h3>Nothing saved yet</h3><p>Tap the heart on any product to keep it here.</p><a class="btn primary" href="#/shop">Discover products</a></div>`
        }
      </div>`;
    staggerIn(view.querySelector('#saved-grid'));
  };
  draw();
  const unsub = saved.subscribe(() => {
    if (!document.body.contains(view)) return unsub();
    // removing from saved: let the heart animation play, then reflow
    setTimeout(draw, 250);
  });
}
