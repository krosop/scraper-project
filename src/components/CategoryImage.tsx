import { useState, useEffect } from 'react';
import { Monitor, Cpu, HardDrive, MemoryStick, Zap, Box, Fan, Gamepad2, Headphones, Keyboard, Mouse, Laptop, Disc, ImageOff, Loader2 } from 'lucide-react';
import { useProductImage } from '@/hooks/useProductImage';

interface CategoryImageProps {
  category: string;
  storeName: string;
  storeColor: string;
  productName: string;
  src: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean; // Preload this image
}

const CATEGORY_ICONS: Record<string, any> = {
  'graphics-cards': Gamepad2,
  'processors': Cpu,
  'memory': MemoryStick,
  'storage': HardDrive,
  'monitors': Monitor,
  'cases': Box,
  'power-supplies': Zap,
  'cooling': Fan,
  'headset': Headphones,
  'keyboard': Keyboard,
  'mouse': Mouse,
  'laptop': Laptop,
  'pc-parts': Disc,
  'default': Box,
};

const CATEGORY_COLORS: Record<string, string> = {
  'graphics-cards': '#00d4aa',
  'processors': '#00b4d8',
  'memory': '#ff6b6b',
  'storage': '#ffd93d',
  'monitors': '#a855f7',
  'cases': '#4ade80',
  'power-supplies': '#f97316',
  'cooling': '#22d3ee',
  'headset': '#ec4899',
  'keyboard': '#3b82f6',
  'mouse': '#14b8a6',
  'laptop': '#8b5cf6',
  'pc-parts': '#6b7280',
  'default': '#374151',
};

const CATEGORY_BG: Record<string, string> = {
  'graphics-cards': 'radial-gradient(circle at 30% 30%, rgba(0,212,170,0.08) 0%, transparent 60%)',
  'processors': 'radial-gradient(circle at 30% 30%, rgba(0,180,216,0.08) 0%, transparent 60%)',
  'memory': 'radial-gradient(circle at 30% 30%, rgba(255,107,107,0.08) 0%, transparent 60%)',
  'storage': 'radial-gradient(circle at 30% 30%, rgba(255,217,61,0.08) 0%, transparent 60%)',
  'monitors': 'radial-gradient(circle at 30% 30%, rgba(168,85,247,0.08) 0%, transparent 60%)',
  'cases': 'radial-gradient(circle at 30% 30%, rgba(74,222,128,0.08) 0%, transparent 60%)',
  'power-supplies': 'radial-gradient(circle at 30% 30%, rgba(249,115,22,0.08) 0%, transparent 60%)',
  'cooling': 'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.08) 0%, transparent 60%)',
  'headset': 'radial-gradient(circle at 30% 30%, rgba(236,72,153,0.08) 0%, transparent 60%)',
  'keyboard': 'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.08) 0%, transparent 60%)',
  'mouse': 'radial-gradient(circle at 30% 30%, rgba(20,184,166,0.08) 0%, transparent 60%)',
  'laptop': 'radial-gradient(circle at 30% 30%, rgba(139,92,246,0.08) 0%, transparent 60%)',
  'pc-parts': 'radial-gradient(circle at 30% 30%, rgba(107,114,128,0.08) 0%, transparent 60%)',
  'default': 'radial-gradient(circle at 30% 30%, rgba(55,65,81,0.08) 0%, transparent 60%)',
};

export default function CategoryImage({ category, storeName, storeColor, productName, src, className, size = 'md', priority = false }: CategoryImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const hasSrc = src && src.length > 10 && !src.includes('product-pc-case');
  const needsFallback = !hasSrc || error;
  const { imageUrl: fetchedImage, loading: fetchingImage } = useProductImage(productName, !needsFallback);

  // Use fetched image if available, otherwise original src
  const effectiveSrc = needsFallback && fetchedImage ? fetchedImage : src;
  const isPlaceholder = !effectiveSrc || (needsFallback && !fetchedImage && !fetchingImage);

  const catKey = CATEGORY_ICONS[category] ? category : 'default';
  const Icon = CATEGORY_ICONS[catKey] || CATEGORY_ICONS.default;
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;
  const bgGradient = CATEGORY_BG[catKey] || CATEGORY_BG.default;

  // Reset states when src changes
  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  const iconSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-12 h-12 sm:w-16 sm:h-16';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px] sm:text-xs';

  if (isPlaceholder) {
    return (
      <div
        className={`${className} relative overflow-hidden`}
        style={{ background: `linear-gradient(135deg, #0d131c 0%, #111821 100%)` }}
      >
        <div className="absolute inset-0 opacity-60" style={{ background: bgGradient }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(${catColor} 1px, transparent 1px), linear-gradient(90deg, ${catColor} 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-4">
          <div
            className="rounded-xl p-2.5 sm:p-3 mb-2 sm:mb-3 border border-[#1a2332]"
            style={{ backgroundColor: `${catColor}10` }}
          >
            {error ? (
              <ImageOff className={`${iconSize} opacity-30`} style={{ color: catColor }} />
            ) : (
              <Icon className={`${iconSize} opacity-30`} style={{ color: catColor }} />
            )}
          </div>
          
          <span className={`${textSize} font-semibold uppercase tracking-[0.08em] opacity-40`} style={{ color: catColor }}>
            {category.replace(/-/g, ' ')}
          </span>
          
          <span className="text-[9px] sm:text-[10px] text-[#4a5568] mt-1 leading-tight text-center px-2 line-clamp-2">
            {productName}
          </span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex justify-center">
          <span
            className="text-[9px] sm:text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-[#1a2332] truncate max-w-full"
            style={{ backgroundColor: `${storeColor}15`, color: storeColor, borderColor: `${storeColor}25` }}
          >
            {storeName}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-[#0d131c] relative overflow-hidden`}>
      <img
        src={effectiveSrc}
        alt={productName}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-contain p-2 transition-opacity duration-500 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'auto' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fetchingImage ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-[#00d4aa] animate-spin" />
              <span className="text-[10px] text-[#4a5568]">Loading image...</span>
            </div>
          ) : (
            <div className="rounded-xl p-3 border border-[#1a2332]" style={{ backgroundColor: `${catColor}08` }}>
              <Icon className="w-10 h-10 sm:w-14 sm:h-14 opacity-20 animate-pulse" style={{ color: catColor }} />
            </div>
          )}
        </div>
      )}
      {loaded && (
        <div className="absolute inset-0 pointer-events-none" style={{
          boxShadow: 'inset 0 0 30px 10px rgba(13,19,28,0.3)',
        }} />
      )}
    </div>
  );
}
