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

export function useProductImage(productName: string, hasImage: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (hasImage || !productName || fetched.current) return;
    
    fetched.current = true;
    setLoading(true);
    
    fetchProductImage(productName)
      .then((url) => {
        if (url) setImageUrl(url);
      })
      .finally(() => setLoading(false));
  }, [productName, hasImage]);

  return { imageUrl, loading };
}
