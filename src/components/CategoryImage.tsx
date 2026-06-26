import { useState } from 'react';
import { Monitor, Cpu, HardDrive, MemoryStick, Zap, Box, Fan, Gamepad2, Headphones, Keyboard, Mouse, Laptop, Disc } from 'lucide-react';

interface CategoryImageProps {
  category: string;
  storeName: string;
  storeColor: string;
  productName: string;
  src: string;
  className?: string;
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

export default function CategoryImage({ category, storeName, storeColor, productName, src, className }: CategoryImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isPlaceholder = !src || src.includes('product-pc-case') || error;
  const catKey = CATEGORY_ICONS[category] ? category : 'default';
  const Icon = CATEGORY_ICONS[catKey] || CATEGORY_ICONS.default;
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;

  if (isPlaceholder) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-[#0d131c] relative`}>
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <Icon className="w-12 h-12 sm:w-16 sm:h-16 mb-2 opacity-40" style={{ color: catColor }} />
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#4a5568] mb-1">
            {category.replace(/-/g, ' ')}
          </span>
          <span className="text-[10px] text-[#5a6a7e] line-clamp-2 leading-tight">
            {productName}
          </span>
        </div>
        {/* Store badge */}
        <div 
          className="absolute bottom-2 left-2 right-2 text-[10px] font-medium px-2 py-1 rounded text-center truncate"
          style={{ backgroundColor: `${storeColor}20`, color: storeColor }}
        >
          {storeName}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-[#0d131c] relative`}>
      <img
        src={src}
        alt={productName}
        className={`w-full h-full object-contain p-2 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-10 h-10 opacity-20 animate-pulse" style={{ color: catColor }} />
        </div>
      )}
    </div>
  );
}
