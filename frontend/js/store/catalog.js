/**
 * Catalogue cache for the storefront.
 * Products = active items (out-of-stock ones included so shoppers see "Sold out").
 * Categories = item types that have at least one active product.
 */
import { api } from '../api.js';
import { cart } from './cart.js';

let products = [];
let categories = [];
let byId = new Map();
let loadedAt = 0;
let pending = null;
const listeners = new Set();

const FRESH_MS = 20000;

export function onCatalogChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadCatalog({ force = false } = {}) {
  if (!force && loadedAt && Date.now() - loadedAt < FRESH_MS) return { products, categories };
  if (pending) return pending;
  pending = Promise.all([
    api.items.list({ status: 'active', sort: 'popular', order: 'desc' }),
    api.itemTypes.list(),
  ])
    .then(([itemRes, typeRes]) => {
      products = itemRes.data;
      byId = new Map(products.map((p) => [p.id, p]));
      categories = typeRes.data
        .map((t) => ({ ...t, count: products.filter((p) => p.item_type_id === t.id).length }))
        .filter((t) => t.count > 0);
      loadedAt = Date.now();
      pending = null;
      cart.reconcile(byId);
      listeners.forEach((fn) => fn());
      return { products, categories };
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

export function invalidateCatalog() {
  loadedAt = 0;
}

export function getProduct(id) {
  return byId.get(Number(id)) || null;
}

export function getProducts() {
  return products;
}

export function getCategories() {
  return categories;
}

export function categoryById(id) {
  return categories.find((c) => String(c.id) === String(id)) || null;
}

/** Simple relevance search across name, category and description */
export function searchProducts(query, limit = 50) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return products
    .map((p) => {
      const name = p.name.toLowerCase();
      const hay = `${name} ${p.type_name.toLowerCase()} ${(p.description || '').toLowerCase()}`;
      if (!words.every((w) => hay.includes(w))) return null;
      let score = 0;
      if (name.startsWith(q)) score += 50;
      if (name.includes(q)) score += 25;
      words.forEach((w) => {
        if (name.split(/\s+/).some((part) => part.startsWith(w))) score += 10;
        if (p.type_name.toLowerCase().includes(w)) score += 4;
      });
      if (p.stock_available > 0) score += 3;
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((r) => r.p);
}
