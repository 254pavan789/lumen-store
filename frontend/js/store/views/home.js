import { esc, icon, money } from '../../ui.js';
import { categoryArt, productArt } from '../art.js';
import { loadCatalog } from '../catalog.js';
import { cartControl, productGrid, rail, railNav, recentProducts, stockInfo } from '../components.js';
import { countUp, moveIndicator, reducedMotion, reveal, staggerIn } from '../motion.js';
import { navigate } from '../../state.js';

function skeleton() {
  return `<div class="container">
    <div class="bento-hero">
      <div class="skeleton" style="grid-area:intro;border-radius:32px;min-height:460px"></div>
      <div class="skeleton" style="grid-area:spot;border-radius:28px;min-height:220px"></div>
      <div class="skeleton" style="grid-area:cat;border-radius:28px;min-height:200px"></div>
      <div class="skeleton" style="grid-area:live;border-radius:28px;min-height:200px"></div>
    </div>
  </div>`;
}

let rotateTimer = null;

export async function render(view, params, ctx) {
  view.innerHTML = skeleton();
  const { products, categories } = await loadCatalog();
  if (!ctx.isCurrent()) return;
  clearInterval(rotateTimer);

  const inStock = products.filter((p) => p.stock_available > 0);
  const byPopular = [...inStock].sort((a, b) => b.units_sold - a.units_sold || b.price - a.price);
  const bestsellers = byPopular.filter((p) => p.units_sold > 0).slice(0, 4).map((p) => p.id);
  const newest = [...products].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  const budget = inStock.filter((p) => p.price <= 999).sort((a, b) => a.price - b.price);
  const almostGone = inStock.filter((p) => p.stock_available <= 5).sort((a, b) => a.stock_available - b.stock_available);
  const units = inStock.reduce((s, p) => s + p.stock_available, 0);
  const cats = [...categories].sort((a, b) => b.count - a.count);
  const topCat = cats[0];
  // spotlight a premium product from a different department than the category tile
  const spotlight = [...inStock].sort((a, b) => b.price - a.price).find((p) => !topCat || p.item_type_id !== topCat.id) || inStock[0];
  const words = cats.slice(0, 5).map((c) => c.type_name.split(/\s*&\s*/)[0]);
  const chips = byPopular.slice(0, 4);
  const recent = recentProducts().filter((p) => p).slice(0, 10);

  const tabs = [
    { key: 'trending', label: 'Trending', list: byPopular.slice(0, 10) },
    { key: 'new', label: 'New in', list: newest.slice(0, 10) },
    { key: 'budget', label: 'Under ₹999', list: budget.slice(0, 10) },
    { key: 'low', label: 'Almost gone', list: almostGone.slice(0, 10) },
  ].filter((t) => t.list.length);

  const maxCat = Math.max(...cats.map((c) => c.count), 1);
  // number of 2x2 tiles so the 4-column bento has no holes: 3*big + n must be a multiple of 4
  let bigTiles = [1, 2, 3, 0].find((b) => b <= cats.length && (3 * b + cats.length) % 4 === 0);
  if (bigTiles === undefined) bigTiles = Math.min(1, cats.length);
  // phones (2 columns, big = full row): odd cell count -> stretch the last tile
  const stretchLast = (cats.length + bigTiles) % 2 === 1;
  const spot = spotlight ? stockInfo(spotlight) : null;

  view.innerHTML = `
    <div class="container home">
      <!-- ============ hero bento ============ -->
      <section class="bento-hero" aria-label="Welcome">
        <div class="tile intro">
          <div class="mesh" aria-hidden="true"><i></i><i></i><i></i><span class="grain"></span></div>
          <div class="intro-copy enter-stagger">
            <span class="eyebrow"><span class="pulse"></span>Live inventory · ${products.length} products</span>
            <h1>Shop the things<br>you love in
              <span class="rotator" aria-live="off"><span class="rot-track">${words.map((w, i) => `<span class="rot-word ${i === 0 ? 'on' : ''}">${esc(w)}.</span>`).join('')}</span></span>
            </h1>
            <p class="lead">Everything on Lumen ships from live stock. Order in seconds, change your mind anytime.</p>
            <form class="hero-search" id="hero-search" role="search">
              ${icon('search')}
              <input type="search" name="q" placeholder="Search Lumen" aria-label="Search products" autocomplete="off" />
              <button class="btn primary" type="submit">Search</button>
            </form>
            <div class="hero-chips"><span>Popular:</span>${chips.map((p) => `<a href="#/product/${p.id}">${esc(p.name)}</a>`).join('')}</div>
          </div>
        </div>

        ${
          spotlight
            ? `<article class="tile spot" data-product="${spotlight.id}">
                <div class="spot-copy">
                  <span class="kicker">${icon('sparkle')}Spotlight</span>
                  <a class="spot-name" href="#/product/${spotlight.id}">${esc(spotlight.name)}</a>
                  <p>${esc((spotlight.description || '').split('.')[0])}</p>
                  <div class="spot-buy"><span class="price">${money(spotlight.price)}</span>${cartControl(spotlight)}</div>
                  ${spot.badge ? `<span class="badge ${spot.badgeCls} plain">${esc(spot.badge)}</span>` : `<span class="muted small">${spotlight.stock_available} in stock</span>`}
                </div>
                <a class="spot-art" href="#/product/${spotlight.id}" data-fly-src tabindex="-1" aria-hidden="true">${productArt(spotlight)}</a>
              </article>`
            : ''
        }

        ${
          topCat
            ? `<a class="tile cat-promo" href="#/shop?cat=${topCat.id}">
                <div class="cp-art">${categoryArt(topCat.type_name)}</div>
                <div class="cp-copy"><span class="kicker">Top category</span><b>${esc(topCat.type_name)}</b><small>${topCat.count} products ${icon('arrow-right')}</small></div>
              </a>`
            : ''
        }

        <div class="tile live">
          <span class="kicker"><span class="pulse dark"></span>Live stock</span>
          <div class="live-num"><b id="live-units" data-value="0">0</b><span>units ready to ship</span></div>
          <div class="mini-bars" aria-hidden="true">
            ${cats
              .slice(0, 7)
              .map((c) => `<span title="${esc(c.type_name)}" style="--h:${Math.round((c.count / maxCat) * 100)}%"><i></i></span>`)
              .join('')}
          </div>
          <small class="muted">${cats.length} categories · updated every order</small>
        </div>
      </section>

      <!-- ============ category marquee ============ -->
      <section class="marquee" aria-label="Categories">
        <div class="marquee-track">
          ${[0, 1]
            .map(
              (dup) => `<div class="marquee-group" ${dup ? 'aria-hidden="true"' : ''}>${cats
                .map((c) => `<a class="m-chip" href="#/shop?cat=${c.id}" ${dup ? 'tabindex="-1"' : ''}><span class="thumb">${categoryArt(c.type_name)}</span>${esc(c.type_name)}<small>${c.count}</small></a>`)
                .join('')}</div>`
            )
            .join('')}
        </div>
      </section>

      <!-- ============ tabbed showcase ============ -->
      <section class="section" data-reveal>
        <div class="sec-head">
          <div><h2>Discover</h2><p>Hand-picked from what’s on the shelves right now.</p></div>
          <a class="link" href="#/shop">Shop all ${icon('arrow-right')}</a>
        </div>
        <div class="seg-tabs" role="tablist" id="disc-tabs">
          <span class="seg-ind" aria-hidden="true"></span>
          ${tabs.map((t, i) => `<button role="tab" aria-selected="${i === 0}" data-tab="${t.key}" class="${i === 0 ? 'active' : ''}">${t.label}</button>`).join('')}
        </div>
        <div class="grid-products" id="disc-grid">${tabs.length ? productGrid(tabs[0].list, { bestsellers }) : ''}</div>
      </section>

      <!-- ============ category bento ============ -->
      <section class="section" id="categories" data-reveal>
        <div class="sec-head"><div><h2>Shop by category</h2><p>${cats.length} departments, one cart.</p></div></div>
        <div class="cat-bento">
          ${cats
            .map(
              (c, i) => `
            <a class="cb-tile ${i < bigTiles ? 'big' : ''} ${stretchLast && i === cats.length - 1 ? 'wide-m' : ''}" href="#/shop?cat=${c.id}">
              <div class="cb-art">${categoryArt(c.type_name)}</div>
              <div class="cb-copy"><b>${esc(c.type_name)}</b><small>${c.count} product${c.count === 1 ? '' : 's'}</small></div>
              <span class="cb-go" aria-hidden="true">${icon('arrow-right')}</span>
            </a>`
            )
            .join('')}
        </div>
      </section>

      <!-- ============ why lumen ============ -->
      <section class="section" data-reveal>
        <div class="sec-head"><div><h2>Shopping that bends to you</h2><p>Real inventory, real flexibility — no surprises after checkout.</p></div></div>
        <div class="features">
          <div class="feature">
            <div class="f-mock">
              <div class="mock-meter"><div class="mm-top"><span>Wireless Headphones</span><b>18 left</b></div><div class="mm-bar"><i style="--w:72%"></i></div></div>
            </div>
            <h3>${icon('zap')}Live stock, always</h3>
            <p>Stock updates the instant anyone orders. If it’s in your bag, it’s on our shelf.</p>
          </div>
          <div class="feature">
            <div class="f-mock">
              <div class="mock-step"><span class="ms-name">Laptop</span><div class="ms-ctl"><i>−</i><b><span class="ms-a">2</span><span class="ms-b">3</span></b><i>+</i></div></div>
              <div class="mock-diff">1 more reserved from stock</div>
            </div>
            <h3>${icon('repeat')}Edit after checkout</h3>
            <p>Add items, change quantities or remove products. Stock adjusts by the difference only.</p>
          </div>
          <div class="feature">
            <div class="f-mock">
              <div class="mock-tl"><span class="on"></span><i></i><span class="on"></span><i></i><span class="x"></span></div>
              <div class="mock-diff">Cancelled · stock returned · history kept</div>
            </div>
            <h3>${icon('shield')}Cancel in one tap</h3>
            <p>Cancel any order and everything goes straight back to stock. Your history stays intact.</p>
          </div>
        </div>
      </section>

      ${
        recent.length >= 2
          ? `<section class="section" data-reveal>
              <div class="sec-head"><div><h2>Recently viewed</h2><p>Pick up where you left off.</p></div>${railNav('rail-recent')}</div>
              ${rail('rail-recent', recent)}
            </section>`
          : ''
      }

      <!-- ============ seller CTA ============ -->
      <section class="section" data-reveal>
        <div class="cta-band">
          <div class="cta-copy">
            <span class="kicker light">${icon('store')}For sellers</span>
            <h2>Run the store behind the store.</h2>
            <p>Products, categories, live inventory and every order — managed in the Seller Hub.</p>
          </div>
          <div class="cta-actions">
            <a class="btn light lg" href="#/admin">Open Seller Hub ${icon('arrow-right')}</a>
          </div>
        </div>
      </section>
    </div>`;

  // hero search
  view.querySelector('#hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    navigate(q ? `#/shop?q=${encodeURIComponent(q)}` : '#/shop');
  });

  // rotating category word
  const rot = view.querySelector('.rot-track');
  if (rot && words.length > 1 && !reducedMotion()) {
    let i = 0;
    const items = [...rot.children];
    rotateTimer = setInterval(() => {
      if (!document.body.contains(rot)) return clearInterval(rotateTimer);
      items[i].classList.remove('on');
      items[i].classList.add('off');
      const prev = items[i];
      setTimeout(() => prev.classList.remove('off'), 500);
      i = (i + 1) % items.length;
      items[i].classList.add('on');
    }, 2600);
  }

  // count-up for live units once visible
  const live = view.querySelector('#live-units');
  reveal(view.querySelector('.tile.live'), () => countUp(live, units, (n) => Math.round(n).toLocaleString('en-IN'), 1100));

  // discover tabs with sliding indicator
  const tabWrap = view.querySelector('#disc-tabs');
  const grid = view.querySelector('#disc-grid');
  const first = tabWrap.querySelector('button.active');
  if (first) requestAnimationFrame(() => moveIndicator(tabWrap.querySelector('.seg-ind'), first, true));
  tabWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn || btn.classList.contains('active')) return;
    tabWrap.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    moveIndicator(tabWrap.querySelector('.seg-ind'), btn);
    const tab = tabs.find((t) => t.key === btn.dataset.tab);
    grid.innerHTML = productGrid(tab.list, { bestsellers });
    staggerIn(grid, ':scope > *', 30, 8);
  });
  window.addEventListener('resize', () => {
    const active = tabWrap.querySelector('button.active');
    if (active && document.body.contains(tabWrap)) moveIndicator(tabWrap.querySelector('.seg-ind'), active, true);
  });

  // scroll reveals
  view.querySelectorAll('[data-reveal]').forEach((el) => reveal(el));
}
