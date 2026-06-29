import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Tag, RotateCcw, Flame } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { useTranslation } from '@/i18n/useTranslation';
import NavigationBar from '@/components/NavigationBar';
import ProductCard from '@/components/ProductCard';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import SEO from '@/components/SEO';

type TrendingSort = 'reviews-desc' | 'price-asc' | 'price-desc' | 'savings-desc' | 'most-listed';

export default function TrendingPage() {
  const { t, isRTL } = useTranslation();
  const { loaded, loading, allProducts } = useData();
  // Default sort: random shuffle for fresh content each visit, include all products + Ouedkniss
  const [sortBy, setSortBy] = useState<TrendingSort>('most-listed');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Deduplicate by product_id — keep the one with highest reviews
  const uniqueTrending = useMemo(() => {
    const byProduct = new Map<string, typeof allProducts[number]>();
    for (const item of allProducts) {
      const existing = byProduct.get(item.product_id);
      if (!existing || item.product_review_count > existing.product_review_count) {
        byProduct.set(item.product_id, item);
      }
    }
    return Array.from(byProduct.values());
  }, [allProducts]);

  // Categories from trending products
  const categories = useMemo(() => {
    const c = new Map<string, string>();
    c.set('all', t.search_all);
    uniqueTrending.forEach((p) => {
      if (!c.has(p.category_slug)) c.set(p.category_slug, p.category_name_fr);
    });
    return Array.from(c.entries());
  }, [uniqueTrending, t]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let results = [...uniqueTrending];

    if (activeCategory !== 'all') {
      results = results.filter((p) => p.category_slug === activeCategory);
    }

    switch (sortBy) {
      case 'reviews-desc':
        results.sort((a, b) => b.product_review_count - a.product_review_count);
        break;
      case 'price-asc':
        results.sort((a, b) => a.current_price - b.current_price);
        break;
      case 'price-desc':
        results.sort((a, b) => b.current_price - a.current_price);
        break;
      case 'savings-desc':
        results.sort((a, b) => b.savings - a.savings);
        break;
      case 'most-listed':
        const listingCounts = new Map<string, number>();
        for (const p of allProducts) {
          listingCounts.set(p.product_id, (listingCounts.get(p.product_id) || 0) + 1);
        }
        results.sort((a, b) => (listingCounts.get(b.product_id) || 0) - (listingCounts.get(a.product_id) || 0));
        break;
    }

    return results;
  }, [uniqueTrending, activeCategory, sortBy, allProducts]);

  const paginated = filtered.slice(0, 15);

  // Preload actual image URLs for visible cards
  useEffect(() => {
    if (loaded && paginated.length > 0) {
      const urls = paginated
        .filter(p => p.product_image && p.product_image.length > 10)
        .slice(0, 15)
        .map(p => p.product_image);
      for (const url of urls) {
        const img = new Image();
        img.src = url!; // Non-null: already filtered above
      }
    }
  }, [loaded, paginated]);

  const sortLabels: Record<TrendingSort, string> = {
    'reviews-desc': t.search_sort_relevance,
    'price-asc': t.search_sort_price_asc,
    'price-desc': t.search_sort_price_desc,
    'savings-desc': t.search_sort_savings,
    'most-listed': 'Most Listed',
  };

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <SEO
        title={`${t.page_trending_title} — PC Algeria`}
        description={t.page_trending_desc}
        keywords="trending PC Algeria, popular graphics card, most searched CPU, best selling RAM Algeria"
        url="https://dztechhunt-v3.vercel.app/#/trending"
      />
      <NavigationBar />

      <main className="pt-16">
        {/* Header */}
        <section className="bg-[#070a10] border-b border-[#1a2332] py-8 sm:py-10">
          <div className="page-padding">
            <div className={`flex items-center gap-1.5 text-[11px] text-[#4a5568] mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/" className="hover:text-[#00d4aa] transition-colors">{t.breadcrumb_home}</Link>
              <span>/</span>
              <span className="text-[#7a8a9e]">{t.page_breadcrumb_trending}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-[#f59e0b]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#f59e0b]">
                    {t.trending_eyebrow}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.page_trending_title}</h1>
                <p className="mt-2 text-[13px] sm:text-[15px] text-[#5a6a7e] max-w-[600px]">
                  {t.page_trending_desc}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-3"
              >
                <div className="bg-[#111821] border border-[#1a2332] rounded-xl px-4 py-3 text-center">
                  <p className="text-xl font-bold text-[#f59e0b]">{uniqueTrending.length}</p>
                  <p className="text-[10px] text-[#4a5568] uppercase tracking-wider font-medium">Products</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Filters & Results */}
        <section className="page-padding py-6 sm:py-8">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none">
              <Tag className="w-4 h-4 text-[#4a5568] shrink-0 hidden sm:block" />
              {categories.map(([slug, name]) => (
                <button
                  key={slug}
                  onClick={() => { setActiveCategory(slug); }}
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

            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as TrendingSort); }}
              className="bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-[12px] font-medium rounded-lg px-3 py-2 outline-none focus:border-[#00d4aa]/50 cursor-pointer shrink-0"
            >
              {(Object.keys(sortLabels) as TrendingSort[]).map((k) => (
                <option key={k} value={k}>{sortLabels[k]}</option>
              ))}
            </select>
          </div>

          {/* Results count */}
          <div className="mb-3 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-[13px] text-[#5a6a7e]">
              {loading || !loaded ? (
                t.loading
              ) : (
                <>
                  <span className="text-white font-semibold">{Math.min(filtered.length, 15)}</span> {t.search_products_found}
                  {filtered.length > 15 && (
                    <span className="text-[#4a5568] ml-1">(top 15)</span>
                  )}
                </>
              )}
            </span>

            {activeCategory !== 'all' && (
              <button
                onClick={() => { setActiveCategory('all'); }}
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
              <Flame className="w-12 h-12 text-[#1a2332] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{t.search_no_results}</h3>
              <p className="text-[13px] text-[#5a6a7e]">{t.search_try_different}</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6"
            >
              {paginated.map((product, i) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  index={i}
                  animate={false}
                  priority={i < 6}
                />
              ))}
            </motion.div>
          )}
        </section>
      </main>
    </div>
  );
}
