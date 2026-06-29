import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fmtDZD } from '@/data/dzProducts';
import { useTranslation } from '@/i18n/useTranslation';
import type { PriceView } from '@/supabase/types';
import StarRating from './StarRating';
import CategoryImage from './CategoryImage';
import { highlightMatches, type HighlightSegment } from '@/utils/smartSearch';

interface ProductCardProps {
  product: PriceView;
  index?: number;
  query?: string;
  animate?: boolean;
  priority?: boolean; // Priority image loading for above-fold cards
}

function HighlightedTitle({ segments }: { segments: HighlightSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.isMatch ? (
          <span
            key={i}
            className={
              seg.matchType === 'exact'
                ? 'text-[#00d4aa] font-semibold'
                : seg.matchType === 'spec'
                ? 'text-[#f59e0b] font-semibold'
                : seg.matchType === 'synonym'
                ? 'text-[#8b5cf6] font-semibold'
                : 'text-[#00d4aa]/80 font-medium'
            }
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

export default function ProductCard({ product, index = 0, query, animate = true, priority = false }: ProductCardProps) {
  const { t } = useTranslation();
  const savingsPercent = product.original_price > 0
    ? Math.round((product.savings / product.original_price) * 100)
    : 0;
  const hasDiscount = product.original_price > product.current_price && product.savings > 0;

  const segments = query ? highlightMatches(product.product_name, query) : null;

  const CardWrapper = animate ? motion.div : 'div';
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, y: 20 } as any,
        whileInView: { opacity: 1, y: 0 } as any,
        viewport: { once: true, amount: 0.1 },
        transition: { duration: 0.4, delay: Math.min(index * 0.06, 0.6), ease: 'easeOut' as const },
      }
    : {};

  return (
    <CardWrapper {...wrapperProps}>
      <Link
        to={`/product/${product.product_slug}`}
        className="group block bg-[#111821] border border-[#1a2332] rounded-xl p-3 sm:p-5 hover:border-[#00d4aa]/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#00d4aa]/5 transition-all duration-300"
      >
        <div className="h-44 sm:h-56 bg-[#0d131c] rounded-lg overflow-hidden mb-3 sm:mb-5">
          <CategoryImage
            src={product.product_image || ''}
            category={product.category_slug}
            storeName={product.store_name}
            storeColor={product.store_color}
            productName={product.product_name}
            className="w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
            priority={priority}
          />
        </div>

        {/* Top row: brand + store badge */}
        <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
          <span
            className="inline-block text-[10px] sm:text-[12px] font-semibold uppercase tracking-[0.06em] px-2 sm:px-3 py-1 sm:py-1.5 rounded-md truncate"
            style={{ color: product.store_color, backgroundColor: `${product.store_color}15` }}
          >
            {product.product_brand}
          </span>
          <span className="text-[10px] text-[#4a5568] truncate">
            {product.store_name}
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-semibold text-[#c8d0d9] group-hover:text-white truncate mb-2 sm:mb-2.5 leading-snug transition-colors min-h-[2.5rem] sm:min-h-[3rem]">
          {segments ? <HighlightedTitle segments={segments} /> : product.product_name}
        </h3>

        <div className="flex items-baseline gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
          <span className="text-lg sm:text-xl font-bold text-[#00d4aa]">
            {fmtDZD(product.current_price)}
          </span>
          {hasDiscount && (
            <span className="text-[11px] sm:text-[13px] text-[#4a5568] line-through">
              {fmtDZD(product.original_price)}
            </span>
          )}
        </div>

        {/* Bottom row: savings + stock */}
        <div className="flex items-center justify-between">
          {hasDiscount ? (
            <span className="text-[10px] sm:text-[12px] font-semibold text-[#00d4aa] bg-[#00d4aa]/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded">
              {t.save} {savingsPercent}%
            </span>
          ) : (
            <span className="text-[10px] sm:text-[12px] text-[#4a5568]">
              {product.store_name}
            </span>
          )}
          {product.stock_status && product.stock_status !== 'متوفر' && (
            <span className="text-[10px] text-[#f59e0b]">
              {product.stock_status}
            </span>
          )}
        </div>

        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#1a2332]">
          <StarRating rating={product.product_rating} size={12} reviewCount={product.product_review_count} />
        </div>
      </Link>
    </CardWrapper>
  );
}
