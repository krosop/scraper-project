import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { buildSearchIndex, type SearchIndex } from '@/utils/smartSearch';
import { getStores, getCategories, getTopDeals, getTrending, getProductCount, getStoreCount, subscribeToPriceChanges } from '@/supabase/api';
import type { PriceView, CategoryStat, StoreRow } from '@/supabase/types';

interface DataContextValue {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  products: PriceView[];
  allProducts: PriceView[];
  categories: CategoryStat[];
  stores: StoreRow[];
  liveDeals: PriceView[];
  trending: PriceView[];
  productCount: number;
  storeCount: number;
  searchIndex: SearchIndex | null;
  refresh: () => void;
}

const DataContext = createContext<DataContextValue>({
  loaded: false,
  loading: true,
  error: null,
  products: [],
  allProducts: [],
  categories: [],
  stores: [],
  liveDeals: [],
  trending: [],
  productCount: 0,
  storeCount: 0,
  searchIndex: null,
  refresh: () => {},
});

export function useData() {
  return useContext(DataContext);
}

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [liveDeals, setLiveDeals] = useState<PriceView[]>([]);
  const [trending, setTrending] = useState<PriceView[]>([]);
  const [allProducts, setAllProducts] = useState<PriceView[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const realtimeRef = useRef<any>(null);

  const loadFromJson = useCallback(async () => {
    try {
      // Bot detection: block headless browsers from loading data
      const { detectHeadlessBrowser, generateFetchToken } = await import('@/utils/botDetector');
      if (detectHeadlessBrowser()) {
        console.warn('Bot detected: blocking data load');
        setError('Access denied');
        return false;
      }

      const token = generateFetchToken();
      const res = await fetch('/data/products.json', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Data-Token': token,
        },
      });
      if (!res.ok) return false;
      const data = await res.json();

      // Build stores list from storeColors
      const storeEntries: StoreRow[] = Object.entries(data.storeColors || {}).map(([name, color]: [string, any], i) => ({
        id: `store-${i}`,
        name,
        color: color as string,
        website: null,
        created_at: new Date().toISOString(),
      }));

      // Build categories
      const cats: CategoryStat[] = (data.categories || []).map((c: any) => ({
        category_slug: c.slug,
        category_name_fr: c.name,
        product_count: c.count,
      }));

      // Build products with prices flattened
      const allProducts: PriceView[] = (data.products || []).flatMap((p: any) =>
        (p.prices || []).map((pr: any) => ({
          product_id: p.id,
          product_slug: p.slug,
          product_name: p.name,
          product_brand: p.brand,
          product_image: p.image,
          product_rating: p.rating,
          product_review_count: p.reviewCount,
          product_description: p.description,
          product_specs: p.specs,
          category_slug: p.category,
          category_name_fr: cats.find(c => c.category_slug === p.category)?.category_name_fr || p.category,
          store_id: `store-${Object.keys(data.storeColors || {}).indexOf(pr.retailer)}`,
          store_name: pr.retailer || '',
          store_color: pr.color || '#00d4aa',
          current_price: pr.current || 0,
          original_price: pr.original || 0,
          savings: pr.savings || 0,
          shipping: pr.shipping || '',
          stock_status: pr.stock || 'متوفر',
          product_url: pr.url || '',
          price_updated_at: new Date().toISOString(),
        }))
      );

      // Seeded random for 2-hour rotation — same 2-hour block = same shuffle, different block = different shuffle
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // '2026-06-29'
      const hourBlock = Math.floor(now.getHours() / 2) * 2;
      const twoHourSeed = `${dateStr}-${String(hourBlock).padStart(2, '0')}`; // '2026-06-29-00', '2026-06-29-02', ...
      function seededRandom(seed: string) {
        let h = 0;
        for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
        const s = (h & 0x7fffffff) / 0x7fffffff;
        return () => {
          h = (h * 16807 + 0) & 0x7fffffff;
          return (h / 0x7fffffff + s) % 1;
        };
      }

      // Products with actual savings (real deals) — pick top 20, then shuffle with 2-hour seed
      const allDealsWithSavings = [...allProducts].filter(p => p.savings > 0).sort((a, b) => b.savings - a.savings);
      const dealRng = seededRandom(twoHourSeed + '-deals');
      const shuffledDeals = [...allDealsWithSavings].sort(() => dealRng() - 0.5);
      const randomLiveDeals = shuffledDeals.slice(0, 10);

      // Most Compared (trending) — shuffle all products with 2-hour seed
      const trendRng = seededRandom(twoHourSeed + '-trending');
      const shuffledAll = [...allProducts].sort(() => trendRng() - 0.5);
      const randomTrending = shuffledAll.slice(0, 15);

      setCategories(cats);
      setStores(storeEntries);
      setAllProducts(allProducts);
      setSearchIndex(buildSearchIndex(allProducts));
      setLiveDeals(randomLiveDeals);
      setTrending(randomTrending);
      setProductCount(data.products?.length || 0);
      setStoreCount(storeEntries.length);
      setLoaded(true);
      setError(null);
      return true;
    } catch (err: any) {
      console.error('DataProvider loadFromJson error:', err);
      return false;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Always load JSON data first (canonical source for allProducts)
      const jsonOk = await loadFromJson();

      const [cats, strs, deals, trend, pCount, sCount] = await Promise.all([
        getCategories(),
        getStores(),
        getTopDeals(10),
        getTrending(10),
        getProductCount(),
        getStoreCount(),
      ]);

      // If Supabase returned data, use it for other fields
      if (cats.length > 0 && deals.length > 0) {
        setCategories(cats as CategoryStat[]);
        setStores(strs);
        setLiveDeals(deals);
        setTrending(trend);
        setProductCount(pCount);
        setStoreCount(sCount);
        setLoaded(true);

        if (!realtimeRef.current) {
          realtimeRef.current = subscribeToPriceChanges(() => {
            getTopDeals(10).then(setLiveDeals);
          });
        }
      } else if (!jsonOk) {
        setError('Aucune donnée disponible');
      }
    } catch (err: any) {
      // On error, try JSON fallback
      const ok = await loadFromJson();
      if (!ok) setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [loadFromJson]);

  useEffect(() => {
    fetchData();
    return () => {
      if (realtimeRef.current) {
        realtimeRef.current.unsubscribe();
      }
    };
  }, [fetchData]);

  return (
      <DataContext.Provider
      value={{
        loaded,
        loading,
        error,
        products: liveDeals,
        allProducts,
        categories,
        stores,
        liveDeals,
        trending,
        productCount,
        storeCount,
        searchIndex,
        refresh: fetchData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
