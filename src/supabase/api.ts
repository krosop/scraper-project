import { getSupabase } from './client';
import type { PriceView, CategoryStat, StoreRow } from './types';
import { loadData, getProductBySlug as getJsonProductBySlug, getTopDeals as getJsonTopDeals, getTrending as getJsonTrending, getRelated as getJsonRelated, getStoreCount as getJsonStoreCount, getProductCount as getJsonProductCount, getAllProducts } from '@/data/dzProducts';
import type { DZProduct } from '@/data/types';

export type { PriceView, CategoryStat, StoreRow };

function db() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  return client;
}

// Convert DZProduct to PriceView[] (flattened prices)
function productToEntries(p: DZProduct): PriceView[] {
  return p.prices.map((pr, i) => ({
    product_id: p.id,
    product_slug: p.slug,
    product_name: p.name,
    product_brand: p.brand,
    product_image: p.image || null,
    product_rating: p.rating,
    product_review_count: p.reviewCount,
    product_description: p.description || null,
    product_specs: p.specs,
    category_slug: p.category,
    category_name_fr: p.category,
    store_id: `store-${i}`,
    store_name: pr.retailer,
    store_color: pr.color,
    current_price: pr.current,
    original_price: pr.original,
    savings: pr.savings,
    shipping: pr.shipping || null,
    stock_status: pr.stock,
    product_url: pr.url || null,
    price_updated_at: new Date().toISOString(),
  }));
}

// ── Helpers ─────────────────────────────────────────────

async function withJsonFallback<T>(
  supabaseFn: () => Promise<T>,
  jsonFn: () => Promise<T>
): Promise<T> {
  try {
    const result = await supabaseFn();
    if (Array.isArray(result) && result.length > 0) return result;
    if (!Array.isArray(result) && result !== null && result !== undefined && (result as any) !== 0) return result;
  } catch { /* Supabase failed, try JSON */ }
  return jsonFn();
}

// ── Stores ──────────────────────────────────────────────

export async function getStores() {
  return withJsonFallback(
    async () => {
      const { data, error } = await db().from('stores').select('*').order('name');
      if (error) throw error;
      return (data || []) as StoreRow[];
    },
    async () => {
      const jsonData = await loadData();
      return Object.entries(jsonData.storeColors).map(([name, color]) => ({
        id: name,
        name,
        color: color as string,
        website: null,
        created_at: new Date().toISOString(),
      })) as StoreRow[];
    }
  );
}

// ── Categories ──────────────────────────────────────────

export async function getCategories() {
  return withJsonFallback(
    async () => {
      const { data, error } = await db().from('category_stats').select('*').order('product_count', { ascending: false });
      if (error) throw error;
      return (data || []) as CategoryStat[];
    },
    async () => {
      const jsonData = await loadData();
      return jsonData.categories.map(c => ({
        category_slug: c.slug,
        category_name_fr: c.name,
        product_count: c.count,
      })) as CategoryStat[];
    }
  );
}

// ── Products ────────────────────────────────────────────

export async function getProducts(opts?: { category?: string; search?: string; store?: string; sortBy?: string; limit?: number }) {
  return withJsonFallback(
    async () => {
      let q = db().from('product_prices').select('*');
      if (opts?.category) q = q.eq('category_slug', opts.category);
      if (opts?.search) q = q.or(`product_name.ilike.%${opts.search}%,product_brand.ilike.%${opts.search}%`);
      if (opts?.store) q = q.eq('store_id', opts.store);
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PriceView[];
    },
    async () => {
      const jsonData = await loadData();
      let products = jsonData.products;
      if (opts?.category) products = products.filter((p: DZProduct) => p.category === opts.category);
      if (opts?.search) {
        const q = opts.search.toLowerCase();
        products = products.filter((p: DZProduct) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
      }
      if (opts?.limit) products = products.slice(0, opts.limit);
      return products.flatMap(productToEntries) as PriceView[];
    }
  );
}

export async function getProductBySlug(slug: string) {
  return withJsonFallback(
    async () => {
      const { data, error } = await db().from('product_prices').select('*').eq('product_slug', slug);
      if (error) throw error;
      return (data || []) as PriceView[];
    },
    async () => {
      await loadData();
      const product = getJsonProductBySlug(slug);
      return product ? productToEntries(product) : [];
    }
  );
}

// ── Top Deals ───────────────────────────────────────────

export async function getTopDeals(limit = 10) {
  return withJsonFallback(
    async () => {
      const { data, error } = await db().from('product_prices').select('*').gt('savings', 0).order('savings', { ascending: false }).limit(limit);
      if (error) throw error;
      return (data || []) as PriceView[];
    },
    async () => {
      await loadData();
      const deals = getJsonTopDeals(limit);
      return deals.flatMap(productToEntries) as PriceView[];
    }
  );
}

// ── Trending ────────────────────────────────────────────

export async function getTrending(limit = 10) {
  return withJsonFallback(
    async () => {
      const { data, error } = await db().from('product_prices').select('*').order('product_review_count', { ascending: false }).limit(limit);
      if (error) throw error;
      return (data || []) as PriceView[];
    },
    async () => {
      await loadData();
      const trend = getJsonTrending(limit);
      return trend.flatMap(productToEntries) as PriceView[];
    }
  );
}

// ── Related Products ────────────────────────────────────

export async function getRelatedProducts(productId: string, categorySlug: string, limit = 6) {
  return withJsonFallback(
    async () => {
      const { data, error } = await db().from('product_prices').select('*').eq('category_slug', categorySlug).neq('product_id', productId).order('current_price', { ascending: true }).limit(limit);
      if (error) throw error;
      return (data || []) as PriceView[];
    },
    async () => {
      await loadData();
      const all = getAllProducts();
      const product = all.find((p: DZProduct) => p.id === productId);
      if (!product) return [];
      const related = getJsonRelated(product, limit);
      return related.flatMap(productToEntries) as PriceView[];
    }
  );
}

// ── Counts ──────────────────────────────────────────────

export async function getProductCount() {
  return withJsonFallback(
    async () => {
      const { count, error } = await db().from('products').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    async () => getJsonProductCount()
  );
}

export async function getStoreCount() {
  return withJsonFallback(
    async () => {
      const { count, error } = await db().from('stores').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    async () => getJsonStoreCount()
  );
}

// ── Real-time Subscriptions ─────────────────────────────

export function subscribeToPriceChanges(callback: (payload: any) => void) {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };
  return client.channel('price_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'prices' }, callback).subscribe();
}

export function subscribeToProductUpdates(productId: string, callback: (payload: any) => void) {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };
  return client.channel(`product_${productId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'prices', filter: `product_id=eq.${productId}` }, callback).subscribe();
}
