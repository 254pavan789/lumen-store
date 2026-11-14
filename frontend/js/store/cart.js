/**
 * Shopping cart + saved items, persisted in localStorage and synced across tabs.
 * The cart only holds { id, qty } - prices and stock always come from the
 * live catalogue, and the backend re-validates everything at checkout.
 */
const CART_KEY = 'lumen.cart.v1';
const SAVED_KEY = 'lumen.saved.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage full or blocked: cart still works for this page view */
  }
}

function createStore(key, initial) {
  let state = read(key, initial);
  const subs = new Set();
  const emit = (detail) => subs.forEach((fn) => fn(detail));
  window.addEventListener('storage', (e) => {
    if (e.key === key) {
      state = read(key, initial);
      emit({ external: true });
    }
  });
  return {
    get: () => state,
    set(next, detail = {}) {
      state = next;
      write(key, state);
      emit(detail);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

const cartStore = createStore(CART_KEY, []);
const savedStore = createStore(SAVED_KEY, []);

const clamp = (n, max) => Math.max(0, Math.min(Math.floor(n), max ?? Infinity));

export const cart = {
  lines: () => cartStore.get().map((l) => ({ ...l })),
  qty: (id) => (cartStore.get().find((l) => l.id === Number(id)) || { qty: 0 }).qty,
  count: () => cartStore.get().reduce((s, l) => s + l.qty, 0),
  subscribe: (fn) => cartStore.subscribe(fn),

  /** add n units; returns resulting quantity (clamped to max stock) */
  add(id, n = 1, max) {
    id = Number(id);
    const lines = cartStore.get().filter((l) => l.id !== id);
    const current = cart.qty(id);
    const qty = clamp(current + n, max);
    if (qty > 0) {
      const existing = cartStore.get().findIndex((l) => l.id === id);
      const next = [...lines];
      next.splice(existing === -1 ? next.length : existing, 0, { id, qty });
      cartStore.set(next, { id, from: current, to: qty });
    }
    return qty;
  },

  set(id, qty, max) {
    id = Number(id);
    const value = clamp(qty, max);
    const current = cart.qty(id);
    if (value <= 0) return cart.remove(id);
    const lines = cartStore.get();
    const idx = lines.findIndex((l) => l.id === id);
    const next = lines.map((l) => ({ ...l }));
    if (idx === -1) next.push({ id, qty: value });
    else next[idx].qty = value;
    cartStore.set(next, { id, from: current, to: value });
    return value;
  },

  remove(id) {
    id = Number(id);
    const current = cart.qty(id);
    cartStore.set(cartStore.get().filter((l) => l.id !== id), { id, from: current, to: 0 });
    return 0;
  },

  clear() {
    cartStore.set([], { cleared: true });
  },

  /** Clamp quantities to live stock and drop products that are gone/inactive. */
  reconcile(productsById) {
    const changes = [];
    const next = [];
    cartStore.get().forEach((l) => {
      const p = productsById.get(l.id);
      if (!p || p.stock_available <= 0) {
        changes.push({ id: l.id, name: p ? p.name : 'An item', to: 0 });
        return;
      }
      if (l.qty > p.stock_available) {
        changes.push({ id: l.id, name: p.name, to: p.stock_available });
        next.push({ id: l.id, qty: p.stock_available });
        return;
      }
      next.push(l);
    });
    if (changes.length) cartStore.set(next, { reconciled: changes });
    return changes;
  },
};

export const saved = {
  ids: () => [...savedStore.get()],
  has: (id) => savedStore.get().includes(Number(id)),
  count: () => savedStore.get().length,
  toggle(id) {
    id = Number(id);
    const list = savedStore.get();
    const on = !list.includes(id);
    savedStore.set(on ? [id, ...list] : list.filter((x) => x !== id), { id, on });
    return on;
  },
  subscribe: (fn) => savedStore.subscribe(fn),
};
