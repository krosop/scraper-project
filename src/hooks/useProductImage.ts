import { useState, useEffect, useRef } from 'react';

const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

/** Build a proxied image URL that handles CORS, caching, and resizing */
export function proxiedImageUrl(originalUrl: string, width: number = 300): string | null {
  if (!originalUrl || originalUrl.length < 10) return null;
  
  // Already proxied — don't double-proxy
  if (originalUrl.includes('weserv.nl') || originalUrl.includes('wsrv.nl')) {
    return originalUrl;
  }
  
  // Data URIs — pass through
  if (originalUrl.startsWith('data:')) return originalUrl;
  
  // Use weserv.nl proxy (free, global CDN, handles CORS, caches images)
  // Parameters: w=width, q=quality, output=webp for smaller size
  try {
    const encoded = encodeURIComponent(originalUrl);
    return `https://images.weserv.nl/?url=${encoded}&w=${width}&q=85&output=webp&n=-1&we`;
  } catch {
    return originalUrl; // fallback to original if encoding fails
  }
}

/** Check if an image URL is available (HEAD request) */
export async function checkImageAvailable(url: string): Promise<boolean> {
  if (!url || url.length < 10) return false;
  
  const cacheKey = `avail_${url}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey) === 'ok';
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { 
      method: 'HEAD', 
      mode: 'no-cors',
      signal: controller.signal 
    });
    
    clearTimeout(timeout);
    imageCache.set(cacheKey, 'ok');
    return true;
  } catch {
    imageCache.set(cacheKey, 'fail');
    return false;
  }
}

/** Preload images in batches — called from page components */
export async function preloadProductImages(imageUrls: string[]): Promise<void> {
  // Just trigger browser preloading via Image objects
  const uniqueUrls = [...new Set(imageUrls.filter(u => u && u.length > 10))];
  
  const BATCH_SIZE = 10;
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(url => 
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Don't block on errors
          img.src = proxiedImageUrl(url) || url;
        })
      )
    );
  }
}

export function useProductImage(productName: string, imageUrl: string | null | undefined) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(imageUrl || null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    // If we already have an image URL, proxy it
    if (imageUrl && imageUrl.length > 10) {
      const proxied = proxiedImageUrl(imageUrl);
      setResolvedUrl(proxied);
      return;
    }
    
    // No image URL available — resolvedUrl stays null, component will show placeholder
    if (!productName || fetched.current) return;
    fetched.current = true;
    
    // No fallback search — just accept there's no image
    setResolvedUrl(null);
  }, [productName, imageUrl]);

  return { imageUrl: resolvedUrl, loading };
}
