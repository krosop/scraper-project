import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, X, Sparkles, Tag, Banknote, Filter,
  TrendingUp, PackageOpen, Zap, RotateCcw, ChevronDown
} from 'lucide-react';
import { useData } from '@/components/DataProvider';
import type { PriceView } from '@/supabase/types';
import { useTranslation } from '@/i18n/useTranslation';
import NavigationBar from '@/components/NavigationBar';
import ProductCard from '@/components/ProductCard';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import SEO from '@/components/SEO';
import {
  smartSearch, getSuggestions, detectQueryIntent,
  type SearchResult, type PriceFilter
} from '@/utils/smartSearch';

const PAGE_SIZE = 20;

// Popular search hints shown when user hasn't typed anything
const SEARCH_HINTS: Record<string, string[]> = {
  en: ['RTX 4060', 'i5 12400F', '16GB DDR4', 'SSD 1TB', 'Gaming mouse', 'Mechanical keyboard', 'Gaming laptop', 'Monitor 144Hz'],
  fr: ['RTX 4060', 'i5 12400F', '16Go DDR4', 'SSD 1To', 'Souris gamer', 'Clavier mécanique', 'PC portable gamer', 'Écran 144Hz'],
  ar: ['RTX 4060', 'i5 12400F', '16GB DDR4', 'SSD 1TB', 'ماوس جيمنج', 'كيبورد ميكانيكي', 'لابتوب جيمنج', 'شاشة 144Hz'],
};

// ---------------------------------------------------------------------------
// No-Results Suggestions Component
// ---------------------------------------------------------------------------
function NoResultsSuggestions({
  query,
  allProducts,
  activeCategory,
  t,
  isRTL,
}: {
  query: string;
  allProducts: PriceView[];
  activeCategory: string;
  t: any;
  isRTL: boolean;
}) {
  const intent = detectQueryIntent(query);

  const popularProducts = useMemo(() => {
    let pool = allProducts;
    if (intent.categories.length > 0) {
      const catSlug = intent.categories[0];
      pool = allProducts.filter(p => p.category_slug === catSlug);
    }
    if (activeCategory !== 'all') {
      pool = allProducts.filter(p => p.category_slug === activeCategory);
    }
    const seen = new Set<string>();
    const deduped: PriceView[] = [];
    for (const p of pool) {
      if (!seen.has(p.product_id)) {
        seen.add(p.product_id);
        deduped.push(p);
      }
    }
    return deduped.sort((a, b) => b.product_review_count - a.product_review_count).slice(0, 5);
  }, [allProducts, intent, activeCategory]);

  const categorySuggestions = useMemo(() => {
    const cats = new Map<string, { name: string; slug: string; count: number }>();
    allProducts.forEach(p => {
      const existing = cats.get(p.category_slug);
      if (existing) {
        existing.count++;
      } else {
        cats.set(p.category_slug, { name: p.category_name_fr, slug: p.category_slug, count: 1 });
      }
    });
    return Array.from(cats.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [allProducts]);

  const trendingSearches = SEARCH_HINTS[isRTL ? 'ar' : 'en'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="py-12 sm:py-16">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#131b26] border border-[#1a2332] rounded-2xl flex items-center justify-center mx-auto mb-5">
          <PackageOpen className="w-8 h-8 sm:w-10 sm:h-10 text-[#2a3545]" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{t.search_no_results}</h3>
        <p className="text-[13px] sm:text-sm text-[#5a6a7e] max-w-md mx-auto mb-6">
          {t.search_no_results_desc} "<span className="text-[#c8d0d9]">{query}</span>". {t.search_try_different}
        </p>
      </div>

      {popularProducts.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#f59e0b]" />
            <h4 className="text-sm font-semibold text-[#c8d0d9]">
              {intent.categories.length > 0 ? t.search_popular_category : t.search_popular}
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
            {popularProducts.map((p, i) => (
              <ProductCard key={p.product_id} product={p} index={i} animate={false} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#8b5cf6]" />
          <h4 className="text-sm font-semibold text-[#c8d0d9]">{t.search_browse_category}</h4>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {categorySuggestions.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onCorrect(cat.name)}
              className="px-4 py-2.5 bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-sm font-medium rounded-xl hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-all"
            >
              {cat.name}
              <span className="ml-1.5 text-[10px] text-[#4a5568]">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#00d4aa]" />
          <h4 className="text-sm font-semibold text-[#c8d0d9]">{t.search_trending}</h4>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {trendingSearches.map((term) => (
            <button
              key={term}
              onClick={() => onCorrect(term)}
              className="px-3 py-1.5 bg-[#0d131c] border border-[#1a2332] text-[#7a8a9e] text-[12px] font-medium rounded-lg hover:border-[#2a3545] hover:text-[#c8d0d9] transition-all"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Search Page
// ---------------------------------------------------------------------------
export default function SearchPage() {
  const { t, lang, isRTL } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loaded, loading, allProducts, searchIndex } = useData();

  const queryParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(queryParam);
  const [inputValue, setInputValue] = useState(queryParam);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'price-asc' | 'price-desc' | 'savings'>('relevance');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [page, setPage] = useState(1);

  // Debounced input for suggestions (300ms)
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedInput, setDebouncedInput] = useState(inputValue);

  useEffect(() => {
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionTimer.current = setTimeout(() => {
      setDebouncedInput(inputValue);
    }, 300);
    return () => {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    };
  }, [inputValue]);

  // Sync URL param to both input and search state
  useEffect(() => {
    setQuery(queryParam);
    setInputValue(queryParam);
    setPage(1);
  }, [queryParam]);

  // Detect query intent for UI hints
  const queryIntent = useMemo(() => {
    if (!query.trim()) return null;
    return detectQueryIntent(query);
  }, [query]);

  // Smart search with the new engine
  const searchResults = useMemo(() => {
    let results: SearchResult<PriceView>[] = [];

    if (query.trim()) {
      results = smartSearch(allProducts, query, searchIndex);
    } else {
      results = [];
    }

    if (activeCategory !== 'all') {
      results = results.filter((r) => r.item.category_slug === activeCategory);
    }

    const bestByProduct = new Map<string, SearchResult<PriceView>>();
    results.forEach((r) => {
      const existing = bestByProduct.get(r.item.product_id);
      if (!existing || r.item.current_price < existing.item.current_price) {
        bestByProduct.set(r.item.product_id, r);
      }
    });
    results = Array.from(bestByProduct.values());

    switch (sortBy) {
      case 'price-asc':
        results = [...results].sort((a, b) => a.item.current_price - b.item.current_price);
        break;
      case 'price-desc':
        results = [...results].sort((a, b) => b.item.current_price - a.item.current_price);
        break;
      case 'savings':
        results = [...results].sort((a, b) => b.item.savings - a.item.savings);
        break;
      default:
        break;
    }

    return results;
  }, [allProducts, query, searchIndex, activeCategory, sortBy]);

  // Paginated results
  const paginatedResults = useMemo(() => {
    return searchResults.slice(0, page * PAGE_SIZE);
  }, [searchResults, page]);

  const hasMore = paginatedResults.length < searchResults.length;

  // Search suggestions (debounced)
  const suggestions = useMemo(() => {
    if (!debouncedInput.trim() || debouncedInput.length < 2) return [];
    const productNames = allProducts.map(p => p.product_name);
    return getSuggestions(productNames, debouncedInput, 6);
  }, [debouncedInput, allProducts]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    cats.set('all', t.search_all);
    allProducts.forEach((p) => {
      if (!cats.has(p.category_slug)) {
        cats.set(p.category_slug, p.category_name_fr);
      }
    });
    return Array.from(cats.entries());
  }, [allProducts, t]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setQuery(trimmed);
    setPage(1);
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setInputValue('');
    setQuery('');
    setPage(1);
    setSearchParams({});
  };

  const formatPriceFilter = (pf: PriceFilter | null): string | null => {
    if (!pf) return null;
    if (pf.min !== undefined && pf.max !== undefined) {
      return `${pf.min.toLocaleString()} – ${pf.max.toLocaleString()} DA`;
    }
    if (pf.min !== undefined) return `≥ ${pf.min.toLocaleString()} DA`;
    if (pf.max !== undefined) return `≤ ${pf.max.toLocaleString()} DA`;
    return null;
  };

  const priceFilterText = queryIntent?.priceFilter ? formatPriceFilter(queryIntent.priceFilter) : null;
  const hasResults = searchResults.length > 0;
  const isEmpty = !loading && loaded && !hasResults && query.trim();
  const noQuery = !loading && loaded && !query.trim();

  const sortLabels: Record<string, string> = {
    relevance: t.search_sort_relevance,
    'price-asc': t.search_sort_price_asc,
    'price-desc': t.search_sort_price_desc,
    savings: t.search_sort_savings,
  };

  const searchHints = SEARCH_HINTS[lang] || SEARCH_HINTS.en;
  const storeCount = new Set(allProducts.map(p => p.store_name)).size;

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <SEO
        title={query ? `${t.search_results_for} ${query} — PC Parts Price Comparison` : `${t.search_title} — PC Parts Price Comparison`}
        description={query ? `Compare prices for ${query} in Algeria. Find the best deals on ${query} from top Algerian stores.` : 'Search and compare prices for graphics cards, CPUs, motherboards, RAM, SSDs, monitors & PC parts from top Algerian stores.'}
        keywords={query ? `${query} price Algeria, buy ${query} Algeria, ${query} Algeria` : 'Algeria PC parts search, graphics card price Algeria, CPU price Algeria'}
        url={`https://dztechhunt-v3.vercel.app/#/search${query ? `?q=${encodeURIComponent(query)}` : ''}`}
      />
      <NavigationBar />

      <main className="pt-16">
        {/* Search Header */}
        <section className="bg-[#070a10] border-b border-[#1a2332] py-8 sm:py-10">
          <div className="page-padding">
            {/* Breadcrumb */}
            <div className={`flex items-center gap-1.5 text-[11px] text-[#4a5568] mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/" className="hover:text-[#00d4aa] transition-colors">{t.breadcrumb_home}</Link>
              <span>/</span>
              <span className="text-[#7a8a9e]">{t.search_title}</span>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-bold text-white mb-4"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {query ? (
                <>
                  {t.search_results_for} "<span className="text-[#00d4aa]">{query}</span>"
                </>
              ) : (
                t.search_title
              )}
            </motion.h1>

            {/* Search Bar */}
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleSearch}
              className="flex items-center bg-[#131b26] border border-[#1a2332] rounded-xl focus-within:border-[#00d4aa]/50 focus-within:ring-2 focus-within:ring-[#00d4aa]/10 transition-all"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#4a5568] mx-3 sm:mx-4 shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={t.hero_search_placeholder}
                className={`flex-1 h-10 sm:h-14 text-sm sm:text-[15px] text-white placeholder:text-[#4a5568] bg-transparent outline-none ${isRTL ? 'text-right' : 'text-left'}`}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="p-2 text-[#4a5568] hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              <button
                type="submit"
                className="h-8 sm:h-[42px] mx-1 sm:mx-1.5 px-3 sm:px-5 bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0e14] text-xs sm:text-sm font-bold rounded-lg transition-colors shrink-0"
              >
                {t.hero_search_btn}
              </button>
            </motion.form>

            {/* Search Suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-2 bg-[#111821] border border-[#1a2332] rounded-xl overflow-hidden shadow-lg"
                >
                  <div className="px-3 py-2 text-[10px] text-[#4a5568] uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {t.search_suggestions}
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInputValue(s);
                        setQuery(s);
                        setPage(1);
                        setSearchParams({ q: s });
                        setShowSuggestions(false);
                      }}
                      className={`w-full text-${isRTL ? 'right' : 'left'} px-4 py-2.5 text-[13px] text-[#c8d0d9] hover:bg-[#00d4aa]/5 hover:text-[#00d4aa] transition-colors flex items-center gap-2`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <Search className="w-3.5 h-3.5 text-[#4a5568] shrink-0" />
                      <span className="truncate">{s}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search Hints — shown when no query entered */}
            {noQuery && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4"
              >
                <p className="text-[11px] text-[#4a5568] uppercase tracking-wider font-semibold mb-2.5">
                  {t.search_trending}
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchHints.map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setInputValue(term);
                        setQuery(term);
                        setPage(1);
                        setSearchParams({ q: term });
                      }}
                      className="px-3 py-1.5 bg-[#0d131c] border border-[#1a2332] text-[#7a8a9e] text-[12px] font-medium rounded-lg hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-all"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Intent badges */}
            {queryIntent && (queryIntent.brands.length > 0 || queryIntent.categories.length > 0 || queryIntent.specs.length > 0 || priceFilterText) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center gap-2 mt-3"
              >
                {priceFilterText && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#00d4aa]/10 text-[#00d4aa] text-[11px] font-medium rounded-md border border-[#00d4aa]/20">
                    <Banknote className="w-3 h-3" /> {priceFilterText}
                  </span>
                )}
                {queryIntent.brands.map(b => (
                  <span key={b} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2563eb]/10 text-[#60a5fa] text-[11px] font-medium rounded-md border border-[#2563eb]/20">
                    <Tag className="w-3 h-3" /> {b}
                  </span>
                ))}
                {queryIntent.categories.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#8b5cf6]/10 text-[#a78bfa] text-[11px] font-medium rounded-md border border-[#8b5cf6]/20">
                    <Filter className="w-3 h-3" /> {c}
                  </span>
                ))}
                {queryIntent.specs.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#f59e0b]/10 text-[#fbbf24] text-[11px] font-medium rounded-md border border-[#f59e0b]/20">
                    <Sparkles className="w-3 h-3" /> {s.value}{s.unit}
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* Filters & Results */}
        <section className="page-padding py-6 sm:py-8">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none">
              <SlidersHorizontal className="w-4 h-4 text-[#4a5568] shrink-0 hidden sm:block" />
              {categories.map(([slug, name]) => (
                <button
                  key={slug}
                  onClick={() => { setActiveCategory(slug); setPage(1); }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeCategory === slug
                      ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30'
                      : 'bg-[#131b26] text-[#7a8a9e] border border-[#1a2332] hover:border-[#2a3545]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-[12px] font-medium rounded-lg px-3 py-2 outline-none focus:border-[#00d4aa]/50 cursor-pointer shrink-0"
            >
              <option value="relevance">{sortLabels.relevance}</option>
              <option value="price-asc">{sortLabels['price-asc']}</option>
              <option value="price-desc">{sortLabels['price-desc']}</option>
              <option value="savings">{sortLabels.savings}</option>
            </select>
          </div>

          {/* Results count */}
          <div className="mb-3 sm:mb-4 flex items-center justify-between">
            <span className="text-xs sm:text-[13px] text-[#5a6a7e]">
              {loading || !loaded ? (
                t.loading
              ) : query ? (
                <>
                  <span className="text-white font-semibold">{searchResults.length.toLocaleString()}</span> {t.search_products_found}
                  {query && (
                    <>
                      {' '}{t.search_results_for} "<span className="text-[#00d4aa]">{query}</span>"
                    </>
                  )}
                  {hasMore && (
                    <span className="text-[#4a5568] ml-1">({t.search_showing} {paginatedResults.length})</span>
                  )}
                </>
              ) : (
                t.search_start_typing
              )}
            </span>

            {query && (
              <button
                onClick={clearSearch}
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
          ) : isEmpty ? (
            <NoResultsSuggestions
              query={query}
              allProducts={allProducts}
              activeCategory={activeCategory}
              t={t}
              isRTL={isRTL}
            />
          ) : noQuery ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-[#1a2332] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{t.search_start_typing}</h3>
              <p className="text-[13px] text-[#5a6a7e] max-w-sm mx-auto">
                {t.search_start_desc
                  .replace('{count}', allProducts.length.toLocaleString())
                  .replace('{stores}', String(storeCount))}
              </p>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6"
              >
                {paginatedResults.map((result, i) => (
                  <ProductCard
                    key={`${result.item.product_id}-${i}`}
                    product={result.item}
                    index={i}
                    query={query.trim() || undefined}
                    animate={false}
                  />
                ))}
              </motion.div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-sm font-medium rounded-xl hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-all"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {t.search_load_more} ({searchResults.length - paginatedResults.length} {t.search_remaining})
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
