import { esc, icon, money } from '../../ui.js';
import { categoryById, getCategories, getProducts, loadCatalog, searchProducts } from '../catalog.js';
import { productGrid } from '../components.js';
import { staggerIn } from '../motion.js';
import { openOverlay } from '../overlay.js';

const SORTS = {
  popular: { label: 'Most popular', fn: (a, b) => b.units_sold - a.units_sold || b.price - a.price },
  price_asc: { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  price_desc: { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
  newest: { label: 'Newest first', fn: (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id },
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
};

function readState() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  return {
    cat: q.get('cat') || '',
    q: q.get('q') || '',
    sort: SORTS[q.get('sort')] ? q.get('sort') : 'popular',
    avail: q.get('avail') === 'in' ? 'in' : '',
    min: q.get('min') || '',
    max: q.get('max') || '',
  };
}

function writeState(s) {
  const q = new URLSearchParams();
  Object.entries(s).forEach(([k, v]) => {
    if (v && !(k === 'sort' && v === 'popular')) q.set(k, v);
  });
  const text = q.toString();
  history.replaceState(null, '', `#/shop${text ? `?${text}` : ''}`);
}

function apply(s) {
  let list = s.q ? searchProducts(s.q, 500) : [...getProducts()];
  if (s.cat) list = list.filter((p) => String(p.item_type_id) === String(s.cat));
  if (s.avail === 'in') list = list.filter((p) => p.stock_available > 0);
  if (s.min !== '' && !Number.isNaN(Number(s.min))) list = list.filter((p) => p.price >= Number(s.min));
  if (s.max !== '' && !Number.isNaN(Number(s.max))) list = list.filter((p) => p.price <= Number(s.max));
  if (!s.q || s.sort !== 'popular') list.sort(SORTS[s.sort].fn);
  // sold-out products always sink to the end
  return [...list.filter((p) => p.stock_available > 0), ...list.filter((p) => p.stock_available <= 0)];
}

function filtersHtml(s) {
  const cats = getCategories();
  const total = getProducts().length;
  return `
    <div class="filters" id="filters">
      <div>
        <h4>Category</h4>
        <div class="f-list">
          <button class="f-opt ${s.cat ? '' : 'active'}" data-cat="">All products <span class="c">${total}</span></button>
          ${cats.map((c) => `<button class="f-opt ${String(s.cat) === String(c.id) ? 'active' : ''}" data-cat="${c.id}">${esc(c.type_name)} <span class="c">${c.count}</span></button>`).join('')}
        </div>
      </div>
      <div>
        <h4>Availability</h4>
        <label class="switch"><span>In stock only</span><input type="checkbox" data-avail ${s.avail ? 'checked' : ''}/><span class="track"></span></label>
      </div>
      <div>
        <h4>Price</h4>
        <div class="price-inputs">
          <input class="input num" type="number" min="0" placeholder="Min ₹" data-min value="${esc(s.min)}" aria-label="Minimum price" />
          <span class="muted">–</span>
          <input class="input num" type="number" min="0" placeholder="Max ₹" data-max value="${esc(s.max)}" aria-label="Maximum price" />
        </div>
        <div class="f-list" style="margin-top:8px">
          ${[
            ['', '999', 'Under ₹999'],
            ['1000', '4999', '₹1,000 – ₹4,999'],
            ['5000', '', '₹5,000 & above'],
          ]
            .map(([mn, mx, label]) => `<button class="f-opt ${s.min === mn && s.max === mx && (mn || mx) ? 'active' : ''}" data-range="${mn}|${mx}">${label}</button>`)
            .join('')}
        </div>
      </div>
      <button class="btn outline" data-reset>${icon('refresh')}Reset filters</button>
    </div>`;
}

export async function render(view, params, ctx) {
  view.innerHTML = `<div class="container"><div class="skeleton" style="height:60px;margin-top:28px;width:40%"></div>
    <div class="grid-products" style="margin-top:28px">${'<div class="skeleton" style="height:360px;border-radius:24px"></div>'.repeat(8)}</div></div>`;
  await loadCatalog();
  if (!ctx.isCurrent()) return;

  const state = readState();

  view.innerHTML = `
    <div class="container">
      <div class="page-title" id="shop-title"></div>
      <div class="shop">
        <aside id="filters-wrap">${filtersHtml(state)}</aside>
        <section>
          <div class="results-bar">
            <span class="count" id="count"></span>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn outline filters-toggle" id="open-filters">${icon('sliders')}Filters</button>
              <select class="input" id="sort" aria-label="Sort products">
                ${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="active-filters" id="chips"></div>
          <div class="grid-products" id="grid"></div>
        </section>
      </div>
    </div>`;

  const update = (animate = false) => {
    writeState(state);
    const list = apply(state);
    const cat = state.cat ? categoryById(state.cat) : null;
    view.querySelector('#shop-title').innerHTML = `
      <div class="crumbs"><a href="#/">Home</a>${icon('chev-right')}<a href="#/shop">Shop</a>${cat ? `${icon('chev-right')}<span>${esc(cat.type_name)}</span>` : ''}</div>
      <h1>${state.q ? `Results for “${esc(state.q)}”` : cat ? esc(cat.type_name) : 'All products'}</h1>`;
    view.querySelector('#count').innerHTML = `<b>${list.length}</b> product${list.length === 1 ? '' : 's'}`;

    const chips = [];
    if (state.q) chips.push(['q', `Search: ${state.q}`]);
    if (cat) chips.push(['cat', cat.type_name]);
    if (state.avail) chips.push(['avail', 'In stock only']);
    if (state.min || state.max) chips.push(['price', `${state.min ? money(state.min) : '₹0'} – ${state.max ? money(state.max) : 'any'}`]);
    view.querySelector('#chips').innerHTML = chips.map(([k, label]) => `<button data-clear="${k}">${esc(label)}${icon('x')}</button>`).join('');

    const grid = view.querySelector('#grid');
    if (!list.length) {
      const suggestions = getProducts().filter((p) => p.stock_available > 0).slice(0, 3);
      grid.outerHTML = `<div id="grid"><div class="empty">${icon('search')}<h3>No products match</h3><p>Try removing a filter or searching for something else.</p>
        <button class="btn primary" data-reset>Clear all filters</button></div>
        ${suggestions.length ? `<div class="sec-head" style="margin-top:12px"><h2 style="font-size:1.2rem">You might like</h2></div><div class="grid-products">${productGrid(suggestions)}</div>` : ''}</div>`;
    } else {
      if (grid.tagName !== 'DIV' || !grid.classList.contains('grid-products')) {
        grid.outerHTML = '<div class="grid-products" id="grid"></div>';
      }
      const g = view.querySelector('#grid');
      g.innerHTML = productGrid(list);
      if (animate) staggerIn(g);
    }
    // refresh filter panel highlight state
    view.querySelectorAll('#filters-wrap').forEach((w) => (w.innerHTML = filtersHtml(state)));
    const sheet = document.querySelector('#drawer-root .drawer .filters');
    if (sheet) sheet.outerHTML = filtersHtml(state);
  };

  const handle = (e) => {
    const t = e.target;
    const catBtn = t.closest('[data-cat]');
    if (catBtn) {
      state.cat = catBtn.dataset.cat;
      update(true);
      return;
    }
    const range = t.closest('[data-range]');
    if (range) {
      const [mn, mx] = range.dataset.range.split('|');
      const same = state.min === mn && state.max === mx;
      state.min = same ? '' : mn;
      state.max = same ? '' : mx;
      update(true);
      return;
    }
    if (t.closest('[data-reset]')) {
      Object.assign(state, { cat: '', q: '', avail: '', min: '', max: '', sort: 'popular' });
      view.querySelector('#sort').value = 'popular';
      update(true);
      return;
    }
    const clear = t.closest('[data-clear]');
    if (clear) {
      const k = clear.dataset.clear;
      if (k === 'price') {
        state.min = '';
        state.max = '';
      } else state[k] = '';
      update(true);
    }
  };
  const handleInput = (e) => {
    const t = e.target;
    if (t.matches('[data-avail]')) {
      state.avail = t.checked ? 'in' : '';
      update(true);
    } else if (t.matches('[data-min], [data-max]')) {
      state[t.matches('[data-min]') ? 'min' : 'max'] = t.value;
      clearTimeout(handleInput.t);
      handleInput.t = setTimeout(() => {
        const focused = t.matches('[data-min]') ? '[data-min]' : '[data-max]';
        update(false);
        const again = view.querySelector(`#filters-wrap ${focused}`);
        if (again && window.innerWidth > 960) {
          again.focus();
          again.setSelectionRange?.(again.value.length, again.value.length);
        }
      }, 450);
    }
  };

  view.addEventListener('click', handle);
  view.addEventListener('input', handleInput);
  view.addEventListener('change', (e) => {
    if (e.target.id === 'sort') {
      state.sort = e.target.value;
      update(true);
    }
  });

  // mobile filter sheet
  view.querySelector('#open-filters').addEventListener('click', () => {
    const { panel } = openOverlay(
      `<div class="drawer-head"><h2>${icon('sliders')}Filters</h2><button class="icon-btn" data-close aria-label="Close filters">${icon('x')}</button></div>
       <div class="drawer-body" style="padding-top:18px">${filtersHtml(state)}</div>
       <div class="drawer-foot"><button class="btn primary block lg" data-close id="show-results">Show results</button></div>`,
      { variant: 'left', label: 'Filters' }
    );
    const label = () => {
      const n = apply(state).length;
      const btn = panel.querySelector('#show-results');
      if (btn) btn.textContent = `Show ${n} result${n === 1 ? '' : 's'}`;
    };
    panel.addEventListener('click', (e) => {
      handle(e);
      label();
    });
    panel.addEventListener('input', (e) => {
      handleInput(e);
      setTimeout(label, 500);
    });
    label();
  });

  update(true);
}

