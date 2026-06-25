import type { DZProduct, DZCategory } from './types';

export type { DZProduct, DZCategory, RetailerPrice } from './types';

// Lazy load the big JSON - don't bundle it
let _data: { storeColors: Record<string, string>; categories: DZCategory[]; products: DZProduct[] } | null = null;
let _loading: Promise<void> | null = null;

const CACHE_KEY = 'pricezap_dz_data';
const CACHE_VERSION = 'v2';

function getCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed._v === CACHE_VERSION) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function setCache(data: unknown) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ _v: CACHE_VERSION, data }));
  } catch { /* ignore */ }
}

export async function loadData() {
  if (_data) return _data;
  if (_loading) { await _loading; return _data!; }

  _loading = (async () => {
    // Try cache first for instant load
    const cached = getCache();
    if (cached) {
      _data = cached as typeof _data;
      // Refresh in background
      fetchFresh().then(fresh => { if (fresh) setCache(fresh); });
      return;
    }

    // No cache - must fetch
    const fresh = await fetchFresh();
    if (fresh) {
      _data = fresh;
      setCache(fresh);
    }
  })();

  await _loading;
  return _data!;
}

async function fetchFresh() {
  try {
    const res = await fetch('/data/products.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = await res.json();
    return json as typeof _data;
  } catch {
    return null;
  }
}

// Synchronous access after load
export function getAllProducts(): DZProduct[] {
  return _data?.products || [];
}

export function getCategories(): DZCategory[] {
  return _data?.categories || [];
}

export function getStoreColors(): Record<string, string> {
  return _data?.storeColors || {};
}

export function getProductBySlug(slug: string): DZProduct | undefined {
  return _data?.products.find(p => p.slug === slug);
}

export function getProductsByCategory(slug: string): DZProduct[] {
  return _data?.products.filter(p => p.category === slug) || [];
}

export function getTopDeals(count: number = 10): DZProduct[] {
  const products = _data?.products || [];
  return [...products]
    .filter(p => p.prices.length >= 2)
    .sort((a, b) => {
      const aSavings = a.prices[0]?.original ? (a.prices[0].original - a.prices[0].current) / a.prices[0].original : 0;
      const bSavings = b.prices[0]?.original ? (b.prices[0].original - b.prices[0].current) / b.prices[0].original : 0;
      return bSavings - aSavings;
    })
    .slice(0, count);
}

export function getTrending(count: number = 10): DZProduct[] {
  const products = _data?.products || [];
  return [...products]
    .filter(p => p.prices.length >= 2)
    .sort((a, b) => b.prices.length - a.prices.length)
    .slice(0, count);
}

export function getRelated(product: DZProduct, count: number = 6): DZProduct[] {
  const products = _data?.products || [];
  return products
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, count);
}

export function getProductCount(): number {
  return _data?.products.length || 0;
}

export function getStoreCount(): number {
  return Object.keys(_data?.storeColors || {}).length;
}

export function getLiveDeals(count: number = 10) {
  return getTopDeals(count).map(p => {
    const best = p.prices[0];
    return {
      product: p,
      bestRetailer: best.retailer,
      bestColor: best.color,
      currentPrice: best.current,
      originalPrice: best.original,
      savings: best.savings,
      savingsPercent: best.original > 0 ? Math.round((best.savings / best.original) * 100) : 0,
    };
  });
}

export function searchProducts(query: string): DZProduct[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const products = _data?.products || [];
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q)
  );
}

export function fmtDZD(n: number): string {
  return n.toLocaleString('fr-DZ') + ' DA';
}

export function getCategoryName(slug: string): string {
  const cat = _data?.categories.find(c => c.slug === slug);
  return cat?.name || slug;
}
