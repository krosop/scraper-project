import { useState, useEffect, useRef } from 'react';

const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string>>();

const API_BASE = import.meta.env.PROD 
  ? 'https://dztechhunt-v3.vercel.app/api/images' 
  : '/api/images';

export async function fetchProductImage(productName: string): Promise<string | null> {
  const cacheKey = productName.trim().toLowerCase();
  
  // Check memory cache
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // Check localStorage cache
  try {
    const stored = localStorage.getItem(`img_${cacheKey}`);
    if (stored) {
      const { url, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) { // 7 days
        imageCache.set(cacheKey, url);
        return url;
      }
    }
  } catch { /* ignore */ }

  // Deduplicate in-flight requests
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const request = fetch(`${API_BASE}?q=${encodeURIComponent(productName)}`)
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const url = data.imageUrl;
      
      // Cache in memory
      imageCache.set(cacheKey, url);
      
      // Cache in localStorage
      try {
        localStorage.setItem(`img_${cacheKey}`, JSON.stringify({ url, timestamp: Date.now() }));
      } catch { /* ignore */ }
      
      return url;
    })
    .catch(() => null)
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, request);
  return request;
}

/** Preload images in batches — called from page components */
export async function preloadProductImages(productNames: string[]): Promise<void> {
  // Filter out already cached names
  const uncached = productNames.filter(name => {
    const key = name.trim().toLowerCase();
    return !imageCache.has(key) && !pendingRequests.has(key);
  });

  if (uncached.length === 0) return;

  // Fire all requests in parallel (up to 20 at a time to avoid overwhelming the API)
  const BATCH_SIZE = 20;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(name => fetchProductImage(name)));
  }
}

export function useProductImage(productName: string, hasImage: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (hasImage || !productName || fetched.current) return;
    
    fetched.current = true;
    
    // Check if already cached (from preload)
    const cacheKey = productName.trim().toLowerCase();
    if (imageCache.has(cacheKey)) {
      setImageUrl(imageCache.get(cacheKey)!);
      return;
    }
    
    setLoading(true);
    
    fetchProductImage(productName)
      .then((url) => {
        if (url) setImageUrl(url);
      })
      .finally(() => setLoading(false));
  }, [productName, hasImage]);

  return { imageUrl, loading };
}
