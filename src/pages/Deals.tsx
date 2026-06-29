import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingDown, Store, RotateCcw, ChevronDown, Zap, Tag } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { useTranslation } from '@/i18n/useTranslation';
import { preloadProductImages } from '@/hooks/useProductImage';
import NavigationBar from '@/components/NavigationBar';
import ProductCard from '@/components/ProductCard';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import SEO from '@/components/SEO';

const PAGE_SIZE = 20;

type DealSort = 'savings-desc' | 'price-asc' | 'price-desc' | 'most-compared';

export default function DealsPage() {
  const { t, isRTL } = useTranslation();
  const { loaded, loading, allProducts } = useData();
  const [sortBy, setSortBy] = useState<DealSort>('most-compared');
  const [activeStore, setActiveStore] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Products with actual savings OR products with multiple listings (most compared)
  const dealsProducts = useMemo(() => {
    // Group by product_id to count listings
    const byProduct = new Map<string, { product: typeof allProducts[0]; listings: number; hasSavings: boolean; bestSavings: number }>();
    
    for (const p of allProducts) {
      const existing = byProduct.get(p.product_id);
      if (!existing) {
        byProduct.set(p.product_id, {
          product: p,
          listings: 1,
          hasSavings: p.savings > 0,
          bestSavings: p.savings,
        });
      } else {
        existing.listings++;
        if (p.savings > existing.bestSavings) {
          existing.bestSavings = p.savings;
          existing.hasSavings = true;
          // Keep the listing with best savings
          existing.product = p;
        }
      }
    }
    
    return Array.from(byProduct.values());
  }, [allProducts]);

  // Filter for products with actual deals first, fallback to most-compared
  const hasRealDeals = dealsProducts.some(d => d.hasSavings);
  
  const uniqueDeals = useMemo(() => {
    if (hasRealDeals) {
      // Only show products with actual savings AND 6+ listings
      return dealsProducts.filter(d => d.hasSavings && d.listings >= 6).map(d => d.product);
    }
    // Fallback: show products with 6+ listings (most compared = best deals potential)
    return dealsProducts.filter(d => d.listings >= 6).map(d => d.product);
  }, [dealsProducts, hasRealDeals]);

  // Available stores and categories
  const stores = useMemo(() => {
    const s = new Map<string, string>();
    s.set('all', t.search_all);
    uniqueDeals.forEach((d) => {
      if (!s.has(d.store_name)) s.set(d.store_name, d.store_name);
    });
    return Array.from(s.entries());
  }, [uniqueDeals, t]);

  const categories = useMemo(() => {
    const c = new Map<string, string>();
    c.set('all', t.search_all);
    uniqueDeals.forEach((d) => {
      if (!c.has(d.category_slug)) c.set(d.category_slug, d.category_name_fr);
    });
    return Array.from(c.entries());
  }, [uniqueDeals, t]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let results = [...uniqueDeals];

    if (activeStore !== 'all') {
      results = results.filter((d) => d.store_name === activeStore);
    }
    if (activeCategory !== 'all') {
      results = results.filter((d) => d.category_slug === activeCategory);
    }

    switch (sortBy) {
      case 'savings-desc':
        results.sort((a, b) => b.savings - a.savings);
        break;
      case 'price-asc':
        results.sort((a, b) => a.current_price - b.current_price);
        break;
      case 'price-desc':
        results.sort((a, b) => b.current_price - a.current_price);
        break;
      case 'most-compared':
        // Sort by number of listings (we need to recompute)
        const listingCounts = new Map<string, number>();
        for (const p of allProducts) {
          listingCounts.set(p.product_id, (listingCounts.get(p.product_id) || 0) + 1);
        }
        results.sort((a, b) => (listingCounts.get(b.product_id) || 0) - (listingCounts.get(a.product_id) || 0));
        break;
    }

    return results;
  }, [uniqueDeals, activeStore, activeCategory, sortBy, allProducts]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const totalSavings = useMemo(() => {
    return uniqueDeals.reduce((sum, d) => sum + d.savings, 0);
  }, [uniqueDeals]);

  // Preload images for visible products
  useEffect(() => {
    if (loaded && paginated.length > 0) {
      const names = paginated
        .filter(p => !p.product_image || p.product_image.length < 10)
        .map(p => p.product_name);
      if (names.length > 0) {
        preloadProductImages(names);
      }
    }
  }, [loaded, paginated]);

  const sortLabels: Record<DealSort, string> = {
    'savings-desc': t.search_sort_savings,
    'price-asc': t.search_sort_price_asc,
    'price-desc': t.search_sort_price_desc,
    'most-compared': 'Most Compared',
  };

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <SEO
        title={`${t.page_deals_title} — PC Deals Algeria`}
        description={t.page_deals_desc}
        keywords="PC deals Algeria, graphics card sale, CPU discount, SSD promo, RAM deal Algeria"
        url="https://dztechhunt-v3.vercel.app/#/deals"
      />
      <NavigationBar />

      <main className="pt-16">
        {/* Header */}
        <section className="bg-[#070a10] border-b border-[#1a2332] py-8 sm:py-10">
          <div className="page-padding">
            <div className={`flex items-center gap-1.5 text-[11px] text-[#4a5568] mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/" className="hover:text-[#00d4aa] transition-colors">{t.breadcrumb_home}</Link>
              <span>/</span>
              <span className="text-[#7a8a9e]">{t.page_breadcrumb_deals}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-[#00d4aa]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#00d4aa]">
                    {hasRealDeals ? t.deals_title : 'Most Compared'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.page_deals_title}</h1>
                <p className="mt-2 text-[13px] sm:text-[15px] text-[#5a6a7e] max-w-[600px]">
                  {hasRealDeals 
                    ? t.page_deals_desc 
                    : 'Products with the most price comparisons across Algerian stores. Real deals coming after next data refresh.'}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-3"
              >
                <div className="bg-[#111821] border border-[#1a2332] rounded-xl px-4 py-3 text-center">
                  <p className="text-xl font-bold text-[#00d4aa]">{uniqueDeals.length}</p>
                  <p className="text-[10px] text-[#4a5568] uppercase tracking-wider font-medium">
                    {hasRealDeals ? 'Deals' : 'Compared'}
                  </p>
                </div>
                {hasRealDeals && (
                  <div className="bg-[#111821] border border-[#1a2332] rounded-xl px-4 py-3 text-center">
                    <p className="text-xl font-bold text-[#00d4aa]">
                      {(totalSavings / 1000).toFixed(0)}K
                    </p>
                    <p className="text-[10px] text-[#4a5568] uppercase tracking-wider font-medium">DA Saved</p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {!hasRealDeals && (
          <div className="page-padding py-3">
            <div className="bg-[#00d4aa]/5 border border-[#00d4aa]/15 rounded-xl px-4 py-3 flex items-center gap-3">
              <Zap className="w-4 h-4 text-[#00d4aa]/60 shrink-0" />
              <p className="text-[12px] text-[#7a8a9e]">
                <span className="text-[#00d4aa] font-medium">Coming soon:</span> Real discount detection is active. After the next daily data refresh, this page will show actual price drops from Algerian stores.
              </p>
            </div>
          </div>
        )}

        {/* Filters & Results */}
        <section className="page-padding py-6 sm:py-8">
          {/* Filter bar */}
          <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none">
              <Store className="w-4 h-4 text-[#4a5568] shrink-0 hidden sm:block" />
              {stores.map(([slug, name]) => (
                <button
                  key={slug}
                  onClick={() => { setActiveStore(slug); setPage(1); }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeStore === slug
                      ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30'
                      : 'bg-[#131b26] text-[#7a8a9e] border border-[#1a2332] hover:border-[#2a3545]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none">
              <Tag className="w-4 h-4 text-[#4a5568] shrink-0 hidden sm:block" />
              {categories.map(([slug, name]) => (
                <button
                  key={slug}
                  onClick={() => { setActiveCategory(slug); setPage(1); }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeCategory === slug
                      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30'
                      : 'bg-[#131b26] text-[#7a8a9e] border border-[#1a2332] hover:border-[#2a3545]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as DealSort); setPage(1); }}
                className="bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-[12px] font-medium rounded-lg px-3 py-2 outline-none focus:border-[#00d4aa]/50 cursor-pointer shrink-0"
              >
                {(Object.keys(sortLabels) as DealSort[]).map((k) => (
                  <option key={k} value={k}>{sortLabels[k]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="mb-3 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-[13px] text-[#5a6a7e]">
              {loading || !loaded ? (
                t.loading
              ) : (
                <>
                  <span className="text-white font-semibold">{filtered.length.toLocaleString()}</span> {t.search_products_found}
                  {hasMore && (
                    <span className="text-[#4a5568] ml-1">({t.search_showing} {paginated.length})</span>
                  )}
                </>
              )}
            </span>

            {(activeStore !== 'all' || activeCategory !== 'all') && (
              <button
                onClick={() => { setActiveStore('all'); setActiveCategory('all'); setPage(1); }}
                className="inline-flex items-center gap-1 text-[11px] text-[#4a5568] hover:text-[#00d4aa] transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> {t.search_clear}
              </button>
            )}
          </div>

          {/* Results grid */}
          {loading || !loaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <TrendingDown className="w-12 h-12 text-[#1a2332] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{t.search_no_results}</h3>
              <p className="text-[13px] text-[#5a6a7e]">{t.search_try_different}</p>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6"
              >
                {paginated.map((deal, i) => (
                  <ProductCard
                    key={deal.product_id}
                    product={deal}
                    index={i}
                    animate={false}
                    priority={i < 6}
                  />
                ))}
              </motion.div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-sm font-medium rounded-xl hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-all"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {t.search_load_more} ({filtered.length - paginated.length} {t.search_remaining})
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
