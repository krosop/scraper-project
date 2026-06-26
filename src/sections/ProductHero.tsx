import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, ExternalLink, Bell, Zap, Heart, Share2, Shield, Truck, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import type { PriceView } from '@/supabase/types';
import { fmtDZD } from '@/data/dzProducts';
import StarRating from '@/components/StarRating';
import CategoryImage from '@/components/CategoryImage';

interface Props {
  entries: PriceView[];
  product: PriceView;
}

export default function ProductHero({ entries, product }: Props) {
  const { t, isRTL } = useTranslation();
  const [isWishlisted, setIsWishlisted] = useState(false);

  const images = product.product_image
    ? [product.product_image]
    : [];

  const uniqueStores = new Set(entries.map(e => e.store_name)).size;
  const cheapest = entries.reduce((min, e) => e.current_price < min.current_price ? e : min, entries[0]);
  const savingsPercent = cheapest.original_price > 0
    ? Math.round((cheapest.savings / cheapest.original_price) * 100)
    : 0;

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const trustBadges = [
    { icon: Shield, text: 'Genuine Products' },
    { icon: Truck, text: 'Algeria Delivery' },
    { icon: RotateCcw, text: 'Price Updates Daily' },
  ];

  return (
    <section className="bg-[#0a0e14]">
      <div className="page-padding py-4 sm:py-8">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex items-center gap-1.5 text-[11px] text-[#4a5568] mb-4 sm:mb-6 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <Link to="/" className="hover:text-[#00d4aa] transition-colors">{t.breadcrumb_home}</Link>
          <ChevronIcon className="w-3 h-3 shrink-0" />
          <span className="hover:text-[#00d4aa] transition-colors cursor-pointer truncate max-w-[100px]">
            {product.category_name_fr}
          </span>
          <ChevronIcon className="w-3 h-3 shrink-0 hidden sm:block" />
          <span className="text-[#5a6a7e] truncate max-w-[150px] hidden sm:inline">{product.product_name}</span>
        </motion.nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-6 sm:gap-10">
          {/* Left: Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="aspect-square bg-[#111821] border border-[#1a2332] rounded-2xl overflow-hidden flex items-center justify-center relative">
              {images.length > 0 ? (
                <img
                  src={images[0]}
                  alt={product.product_name}
                  className="w-[85%] h-[85%] object-contain"
                />
              ) : (
                <CategoryImage
                  src=""
                  category={product.category_slug}
                  storeName={product.store_name}
                  storeColor={product.store_color}
                  productName={product.product_name}
                  className="w-full h-full"
                />
              )}
              {/* Wishlist button */}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#1a2332]/80 backdrop-blur flex items-center justify-center hover:bg-[#2a3545] transition-colors"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'text-red-500 fill-red-500' : 'text-[#5a6a7e]'}`} />
              </button>
            </div>
          </motion.div>

          {/* Right: Info */}
          <div>
            {/* Brand + Store count */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#5a6a7e] bg-[#1a2332] px-2.5 py-1 rounded-md">
                {product.product_brand}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#00d4aa] bg-[#00d4aa]/10 px-2.5 py-1 rounded-md flex items-center gap-1">
                <Zap className="w-3 h-3" /> {uniqueStores} {t.prices_found}
              </span>
              {product.product_review_count > 0 && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#ffd93d] bg-[#ffd93d]/10 px-2.5 py-1 rounded-md">
                  ★ {product.product_rating.toFixed(1)} ({product.product_review_count})
                </span>
              )}
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xl sm:text-2xl md:text-3xl font-bold text-white mt-3 leading-tight"
            >
              {product.product_name}
            </motion.h1>

            {/* Rating */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-3"
            >
              <StarRating rating={product.product_rating} size={16} showValue reviewCount={product.product_review_count} />
            </motion.div>

            {/* Price highlight */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-5 sm:mt-6 p-4 sm:p-5 bg-[#111821] border border-[#1a2332] rounded-xl"
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl font-bold text-[#00d4aa]">
                  {fmtDZD(cheapest.current_price)}
                </span>
                {cheapest.original_price > cheapest.current_price && (
                  <span className="text-base sm:text-lg text-[#4a5568] line-through">
                    {fmtDZD(cheapest.original_price)}
                  </span>
                )}
                {savingsPercent > 0 && (
                  <span className="text-sm font-bold text-[#00d4aa] bg-[#00d4aa]/10 px-2.5 py-1 rounded-md">
                    Save {savingsPercent}%
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-[#5a6a7e]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cheapest.store_color }} />
                <span>Best price at <span className="text-[#c8d0d9] font-medium">{cheapest.store_name}</span></span>
              </div>
            </motion.div>

            {/* Description */}
            {product.product_description && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 text-[14px] sm:text-[15px] text-[#5a6a7e] leading-relaxed"
              >
                {product.product_description}
              </motion.p>
            )}

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-5 flex flex-wrap gap-3"
            >
              {trustBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#5a6a7e] bg-[#111821] border border-[#1a2332] px-3 py-1.5 rounded-lg">
                  <badge.icon className="w-3.5 h-3.5 text-[#00d4aa]" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-5 flex flex-col sm:flex-row gap-3"
            >
              {cheapest.product_url && (
                <a
                  href={cheapest.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-12 bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0e14] font-bold rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buy at {cheapest.store_name}</span>
                </a>
              )}
              <button className="flex-1 sm:flex-initial h-12 bg-[#111821] hover:bg-[#1a2332] text-[#c8d0d9] font-semibold border border-[#1a2332] rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                <Bell className="w-4 h-4 text-[#00d4aa]" />
                <span>{t.price_alert}</span>
              </button>
              <button className="w-12 h-12 bg-[#111821] hover:bg-[#1a2332] border border-[#1a2332] rounded-xl flex items-center justify-center transition-colors active:scale-[0.98]">
                <Share2 className="w-4 h-4 text-[#5a6a7e]" />
              </button>
            </motion.div>

            {/* Price comparison preview (top 3) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-6"
            >
              <h3 className="text-[13px] font-semibold text-[#c8d0d9] uppercase tracking-wider mb-3">
                Price Comparison ({entries.length} stores)
              </h3>
              <div className="space-y-2">
                {entries.slice(0, 3).map((entry, i) => {
                  const isBest = i === 0;
                  return (
                    <div
                      key={`${entry.store_id}-${i}`}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isBest ? 'bg-[#00d4aa]/5 border border-[#00d4aa]/30' : 'bg-[#111821] border border-[#1a2332]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.store_color }} />
                        <span className="text-[13px] font-medium text-[#c8d0d9] truncate">{entry.store_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-white">{fmtDZD(entry.current_price)}</span>
                        {entry.product_url && (
                          <a
                            href={entry.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-medium text-[#00d4aa] border border-[#00d4aa]/30 px-2 py-1 rounded-lg hover:bg-[#00d4aa]/10 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {entries.length > 3 && (
                <p className="text-center text-[11px] text-[#4a5568] mt-2">
                  +{entries.length - 3} more stores — see full comparison below
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
