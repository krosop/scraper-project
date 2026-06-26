import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X, Sparkles } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import type { PriceView } from '@/supabase/types';
import { useTranslation } from '@/i18n/useTranslation';
import NavigationBar from '@/components/NavigationBar';
import ProductCard from '@/components/ProductCard';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import SEO from '@/components/SEO';
import { fuzzySearch, getSuggestions } from '@/utils/fuzzySearch';

export default function SearchPage() {
  const { t, isRTL } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loaded, loading, allProducts } = useData();

  const queryParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(queryParam);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'price-asc' | 'price-desc' | 'savings'>('relevance');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Sync URL param to input
  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  // Smart fuzzy search with suggestions
  const searchResults = useMemo(() => {
    let filtered = allProducts;

    if (query.trim()) {
      // Use fuzzy search with relevance scoring
      const results = fuzzySearch(
        allProducts,
        query,
        (p) => `${p.product_name} ${p.product_brand} ${p.category_name_fr} ${p.store_name}`
      );
      filtered = results.map(r => r.item);
    }

    // Category filter
    if (activeCategory !== 'all') {
      filtered = filtered.filter((p) => p.category_slug === activeCategory);
    }

    // Deduplicate by product_id — keep the lowest price entry per product
    const bestByProduct = new Map<string, PriceView>();
    filtered.forEach((p) => {
      const existing = bestByProduct.get(p.product_id);
      if (!existing || p.current_price < existing.current_price) {
        bestByProduct.set(p.product_id, p);
      }
    });
    filtered = Array.from(bestByProduct.values());

    // Sort
    switch (sortBy) {
      case 'price-asc':
        filtered = [...filtered].sort((a, b) => a.current_price - b.current_price);
        break;
      case 'price-desc':
        filtered = [...filtered].sort((a, b) => b.current_price - a.current_price);
        break;
      case 'savings':
        filtered = [...filtered].sort((a, b) => b.savings - a.savings);
        break;
      default:
        // relevance: keep fuzzy search order
        break;
    }

    return filtered;
  }, [allProducts, query, activeCategory, sortBy]);

  // Search suggestions
  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const productNames = allProducts.map(p => p.product_name);
    return getSuggestions(productNames, query, 6);
  }, [query, allProducts]);

  // Get unique categories from results
  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    cats.set('all', 'All');
    allProducts.forEach((p) => {
      if (!cats.has(p.category_slug)) {
        cats.set(p.category_slug, p.category_name_fr);
      }
    });
    return Array.from(cats.entries());
  }, [allProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    } else {
      setSearchParams({});
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <SEO
        title={query ? `Search: ${query} — PC Parts Price Comparison` : 'Search PC Parts — Compare Prices in Algeria'}
        description={query ? `Compare prices for ${query} in Algeria. Find the best deals on ${query} from top Algerian stores like Lahlou Industrie, Gaming DZ, Digitec DZ and more.` : 'Search and compare prices for graphics cards, CPUs, motherboards, RAM, SSDs, monitors & PC parts from top Algerian stores.'}
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
              <span className="text-[#7a8a9e]">Search</span>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-bold text-white mb-4"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {query ? (
                <>
                  Results for "<span className="text-[#00d4aa]">{query}</span>"
                </>
              ) : (
                'Search Products'
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
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={t.hero_search_placeholder}
                className={`flex-1 h-10 sm:h-14 text-sm sm:text-[15px] text-white placeholder:text-[#4a5568] bg-transparent outline-none ${isRTL ? 'text-right' : 'text-left'}`}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              {query && (
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
                Search
              </button>
            </motion.form>

            {/* Search Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-[#111821] border border-[#1a2332] rounded-xl overflow-hidden shadow-lg"
              >
                <div className="px-3 py-2 text-[10px] text-[#4a5568] uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Suggestions
                </div>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(s);
                      setSearchParams({ q: s });
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-[#c8d0d9] hover:bg-[#00d4aa]/5 hover:text-[#00d4aa] transition-colors flex items-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5 text-[#4a5568]" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* Filters & Results */}
        <section className="page-padding py-6 sm:py-8">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            {/* Category pills — horizontally scrollable on mobile */}
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none">
              <SlidersHorizontal className="w-4 h-4 text-[#4a5568] shrink-0 hidden sm:block" />
              {categories.map(([slug, name]) => (
                <button
                  key={slug}
                  onClick={() => setActiveCategory(slug)}
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

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#131b26] border border-[#1a2332] text-[#c8d0d9] text-[12px] font-medium rounded-lg px-3 py-2 outline-none focus:border-[#00d4aa]/50 cursor-pointer shrink-0"
            >
              <option value="relevance">Relevance</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="savings">Biggest Savings</option>
            </select>
          </div>

          {/* Results count */}
          <div className="mb-3 sm:mb-4">
            <span className="text-xs sm:text-[13px] text-[#5a6a7e]">
              {loading || !loaded ? (
                'Loading...'
              ) : (
                <>
                  <span className="text-white font-semibold">{searchResults.length.toLocaleString()}</span> products found
                  {query && (
                    <>
                      {' '}for "<span className="text-[#00d4aa]">{query}</span>"
                    </>
                  )}
                </>
              )}
            </span>
          </div>

          {/* Results grid */}
          {loading || !loaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <Search className="w-12 h-12 text-[#1a2332] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No products found</h3>
              <p className="text-[13px] text-[#5a6a7e]">
                {query
                  ? `Try different keywords or browse all products`
                  : 'Start typing to search for products'}
              </p>
              {query && (
                <button
                  onClick={clearSearch}
                  className="mt-4 px-4 py-2 bg-[#131b26] border border-[#1a2332] text-[#00d4aa] text-sm font-medium rounded-lg hover:border-[#00d4aa]/30 transition-colors"
                >
                  Clear search
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6"
            >
              {searchResults.map((product, i) => (
                <ProductCard key={`${product.product_id}-${i}`} product={product} index={i} />
              ))}
            </motion.div>
          )}
        </section>
      </main>
    </div>
  );
}
