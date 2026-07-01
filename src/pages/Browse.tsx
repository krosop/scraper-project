import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, PackageOpen, SlidersHorizontal, X, LayoutGrid,
  Monitor, HardDrive, Cpu, MemoryStick, Fan, Plug, Keyboard, Mouse, Headphones,
  Box, Computer, CircuitBoard, Wrench, Laptop
} from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { useTranslation } from '@/i18n/useTranslation';
import NavigationBar from '@/components/NavigationBar';
import ProductCard from '@/components/ProductCard';
import SEO from '@/components/SEO';
import type { LucideIcon } from 'lucide-react';

interface CategoryConfig {
  label: string;
  labelFr: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  laptop: { label: 'Laptops', labelFr: 'PC Portables', icon: Laptop, color: '#00d4aa', bgColor: '#00d4aa50' },
  'graphics-cards': { label: 'Graphics Cards', labelFr: 'Cartes Graphiques', icon: CircuitBoard, color: '#3b82f6', bgColor: '#3b82f650' },
  processors: { label: 'Processors', labelFr: 'Processeurs', icon: Cpu, color: '#6366f1', bgColor: '#6366f150' },
  memory: { label: 'Memory', labelFr: 'Mémoire', icon: MemoryStick, color: '#8b5cf6', bgColor: '#8b5cf650' },
  storage: { label: 'Storage', labelFr: 'Stockage', icon: HardDrive, color: '#06b6d4', bgColor: '#06b6d450' },
  monitors: { label: 'Monitors', labelFr: 'Moniteurs', icon: Monitor, color: '#f59e0b', bgColor: '#f59e0b50' },
  'power-supplies': { label: 'Power Supplies', labelFr: 'Alimentations', icon: Plug, color: '#ef4444', bgColor: '#ef444450' },
  cooling: { label: 'Cooling', labelFr: 'Refroidissement', icon: Fan, color: '#0ea5e9', bgColor: '#0ea5e950' },
  keyboard: { label: 'Keyboards', labelFr: 'Claviers', icon: Keyboard, color: '#10b981', bgColor: '#10b98150' },
  mouse: { label: 'Mice', labelFr: 'Souris', icon: Mouse, color: '#ec4899', bgColor: '#ec489950' },
  headset: { label: 'Headsets', labelFr: 'Casques', icon: Headphones, color: '#f97316', bgColor: '#f9731650' },
  cases: { label: 'Cases', labelFr: 'Boîtiers', icon: Box, color: '#64748b', bgColor: '#64748b50' },
  desktop: { label: 'Desktops', labelFr: 'PC Fixes', icon: Computer, color: '#14b8a6', bgColor: '#14b8a650' },
  'pc-parts': { label: 'PC Parts', labelFr: 'Pièces PC', icon: Wrench, color: '#6b7280', bgColor: '#6b728050' },
};

export default function BrowsePage() {
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();
  const { allProducts, loaded, loading } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'price-asc' | 'price-desc' | 'savings'>('relevance');
  const [showSort, setShowSort] = useState(false);

  // Build category counts
  const categories = useMemo(() => {
    const map = new Map<string, { slug: string; count: number }>();
    for (const p of allProducts) {
      const slug = p.category_slug;
      if (!map.has(slug)) {
        map.set(slug, { slug, count: 0 });
      }
      map.get(slug)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allProducts]);

  // Filter products — when "All" selected, show a MIXED selection from each category
  const filteredProducts = useMemo(() => {
    let pool: typeof allProducts;

    if (activeCategory) {
      pool = allProducts.filter(p => p.category_slug === activeCategory);
    } else {
      // "All" — pick top 3 products from each category for a mixed view
      const categoryMap = new Map<string, typeof allProducts>();
      for (const p of allProducts) {
        if (!categoryMap.has(p.category_slug)) {
          categoryMap.set(p.category_slug, []);
        }
        categoryMap.get(p.category_slug)!.push(p);
      }
      pool = [];
      for (const [, products] of categoryMap) {
        // Sort by rating + review count, fallback to random shuffle
        const sorted = [...products].sort((a, b) => {
          const aScore = (a.product_rating || 0) * 10 + (a.product_review_count || 0);
          const bScore = (b.product_rating || 0) * 10 + (b.product_review_count || 0);
          return bScore - aScore;
        });
        const top = sorted.slice(0, 3);
        pool.push(...top);
      }
      // Proper Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter(p => p.product_name.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'price-asc': pool = [...pool].sort((a, b) => a.current_price - b.current_price); break;
      case 'price-desc': pool = [...pool].sort((a, b) => b.current_price - a.current_price); break;
      case 'savings': pool = [...pool].sort((a, b) => b.savings - a.savings); break;
      default: break;
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped: typeof pool = [];
    for (const p of pool) {
      if (!seen.has(p.product_id)) {
        seen.add(p.product_id);
        deduped.push(p);
      }
    }
    return deduped;
  }, [allProducts, activeCategory, searchQuery, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const sortLabels: Record<string, string> = {
    relevance: 'Relevance',
    'price-asc': 'Price: Low → High',
    'price-desc': 'Price: High → Low',
    savings: 'Best Deals',
  };

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <SEO
        title="Browse PC Parts — DZ TechHunt"
        description="Browse all PC component categories: graphics cards, CPUs, RAM, SSDs, monitors, laptops, and more from Algerian stores."
        url="https://dztechhunt-v3.vercel.app/browse"
      />
      <NavigationBar />

      <main className="pt-16">
        {/* Header */}
        <section className="bg-[#070a10] border-b border-[#1a2332] py-8 sm:py-12">
          <div className="page-padding">
            <div className={`flex items-center gap-1.5 text-[11px] text-[#4a5568] mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/" className="hover:text-[#00d4aa] transition-colors">{t.breadcrumb_home}</Link>
              <span>/</span>
              <span className="text-[#7a8a9e]">Browse</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#00d4aa]">
                Categories
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">Browse All PC Parts</h1>
              <p className="mt-3 text-[14px] sm:text-[15px] text-[#5a6a7e] max-w-[600px] leading-relaxed">
                Explore every category — from GPUs and CPUs to laptops and monitors. Compare prices across Algerian stores.
              </p>
            </motion.div>

            {/* Search bar */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleSearch}
              className="mt-8 max-w-[640px]"
            >
              <div className="flex items-center bg-[#131b26] border border-[#1a2332] rounded-xl focus-within:border-[#00d4aa]/50 focus-within:ring-2 focus-within:ring-[#00d4aa]/10 transition-all">
                <Search className="w-5 h-5 text-[#4a5568] mx-4 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 h-14 px-3 text-[15px] text-white placeholder:text-[#4a5568] bg-transparent outline-none"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="p-2 text-[#4a5568] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button type="submit" className="h-10 mx-2 px-5 bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0e14] text-sm font-bold rounded-lg transition-colors">
                  Search
                </button>
              </div>
            </motion.form>
          </div>
        </section>

        {/* Category Circles */}
        <section className="page-padding py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-8">
              <LayoutGrid className="w-4 h-4 text-[#00d4aa]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00d4aa]">
                Shop by Category
              </h2>
            </div>

            <div className="flex flex-wrap gap-6 sm:gap-8">
              {/* All */}
              <button
                onClick={() => setActiveCategory(null)}
                className="group flex flex-col items-center gap-3 min-w-[80px]"
              >
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  !activeCategory
                    ? 'bg-[#00d4aa]/25 border-2 border-[#00d4aa] shadow-lg shadow-[#00d4aa]/25 scale-105'
                    : 'bg-[#1e293b] border-2 border-[#334155] hover:border-[#00d4aa]/50 hover:bg-[#27354f]'
                }`}>
                  <LayoutGrid className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${!activeCategory ? 'text-[#00d4aa]' : 'text-white group-hover:text-[#00d4aa]'}`} />
                </div>
                <span className={`text-[13px] font-semibold transition-colors ${!activeCategory ? 'text-[#00d4aa]' : 'text-white group-hover:text-white'}`}>
                  All
                </span>
                <span className="text-[11px] text-[#6b7a8f]">{allProducts.length.toLocaleString()}</span>
              </button>

              {categories.map((cat) => {
                const config = CATEGORY_CONFIG[cat.slug] || { label: cat.slug, labelFr: cat.slug, icon: Wrench, color: '#6b7280', bgColor: '#6b728015' };
                const isActive = activeCategory === cat.slug;
                const Icon = config.icon;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => setActiveCategory(isActive ? null : cat.slug)}
                    className="group flex flex-col items-center gap-3 min-w-[80px]"
                  >
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? 'border-2 shadow-lg scale-105'
                        : 'bg-[#1e293b] border-2 border-[#334155] hover:border-[#00d4aa]/50 hover:bg-[#27354f]'
                    }`}
                    style={isActive ? { borderColor: config.color, backgroundColor: config.bgColor, boxShadow: `0 0 24px ${config.color}40` } : {}}
                    >
                      <Icon className="w-8 h-8 sm:w-10 sm:h-10 transition-colors" style={{ color: isActive ? config.color : '#ffffff' }} />
                    </div>
                    <span className={`text-[13px] font-semibold transition-colors ${isActive ? 'text-white' : 'text-white group-hover:text-white'}`}>
                      {config.labelFr}
                    </span>
                    <span className="text-[11px] text-[#6b7a8f]">{cat.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* Results */}
        <section className="page-padding py-8 sm:py-10 border-t border-[#1a2332]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-sm text-[#5a6a7e]">
                {loading || !loaded ? (
                  'Loading...'
                ) : (
                  <>
                    <span className="text-[#00d4aa] font-bold text-lg">{filteredProducts.length}</span>
                    <span className="ml-1">products</span>
                    {activeCategory && (
                      <span className="text-[#4a5568] ml-1">in {CATEGORY_CONFIG[activeCategory]?.labelFr || activeCategory}</span>
                    )}
                    {!activeCategory && (
                      <span className="text-[#4a5568] ml-1">— mixed from all categories</span>
                    )}
                  </>
                )}
              </span>
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-2 px-4 py-2 bg-[#111821] border border-[#1a2332] rounded-lg text-[13px] text-[#5a6a7e] hover:text-white transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {sortLabels[sortBy]}
              </button>
              <AnimatePresence>
                {showSort && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 mt-1 w-44 bg-[#111821] border border-[#1a2332] rounded-lg shadow-xl z-20 overflow-hidden"
                  >
                    {Object.entries(sortLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setSortBy(key as any); setShowSort(false); }}
                        className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                          sortBy === key ? 'text-[#00d4aa] bg-[#00d4aa]/10' : 'text-[#5a6a7e] hover:text-white hover:bg-[#1a2332]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Products grid */}
          {loading || !loaded ? (
            <div className="text-center py-12 text-[#5a6a7e]">Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <PackageOpen className="w-14 h-14 text-[#1a2332] mx-auto mb-4" />
              <p className="text-[#5a6a7e] text-base">No products found</p>
              {activeCategory && (
                <button
                  onClick={() => setActiveCategory(null)}
                  className="mt-4 text-[#00d4aa] text-sm font-semibold hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 sm:gap-6">
              {filteredProducts.slice(0, 40).map((product, i) => (
                <motion.div
                  key={product.product_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          )}

          {filteredProducts.length > 40 && (
            <div className="text-center mt-10">
              <Link
                to={activeCategory ? `/search?cat=${activeCategory}` : '/search'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#111821] border border-[#1a2332] hover:border-[#00d4aa]/30 text-[#00d4aa] text-sm font-semibold rounded-xl transition-all"
              >
                View All {filteredProducts.length} Products <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
