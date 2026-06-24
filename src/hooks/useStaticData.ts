import { useState, useEffect, useMemo, useCallback } from "react";

// Cleaned data format from clean-products.cjs
export interface CleanProduct {
  id: string;
  canonicalName: string;
  brand: string | null;
  category: string;
  specs: Record<string, string | boolean>;
  imageUrl: string | null;
  bestPrice: number;
  worstPrice: number;
  averagePrice: number;
  listingCount: number;
  storeCount: number;
  listings: {
    source: string;
    price: number;
    condition: string;
    location: string;
    url: string;
    imageUrl: string | null;
  }[];
}

// Frontend format (what components expect)
export interface ProcessedProduct {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  specs: Record<string, string>;
  imageUrl: string | null;
  listings: ProductListing[];
  bestPrice: number;
  listingCount: number;
  bestStore: string;
  bestLocation: string;
}

export interface ProductListing {
  id: string;
  price: number;
  condition: string;
  location: string;
  url: string;
  sourceName: string;
  sourceType: string;
  scrapedAt: string;
  expiresAt: string;
  imageUrl: string | null;
}

let dataCache: CleanProduct[] | null = null;

function generateId(prefix: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const absHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `${prefix}-${absHash}`;
}

function mapCleanToProcessed(clean: CleanProduct): ProcessedProduct {
  const listings: ProductListing[] = clean.listings.map((l, idx) => ({
    id: generateId("lst", `${clean.id}-${idx}`),
    price: l.price,
    condition: l.condition || "new",
    location: l.location || "Algeria",
    url: l.url,
    sourceName: l.source,
    sourceType: "axios",
    scrapedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    imageUrl: l.imageUrl || clean.imageUrl || null,
  }));

  // Filter out listings with no URL
  const validListings = listings.filter(l => l.url && l.url.length > 5);

  return {
    id: clean.id,
    name: clean.canonicalName,
    category: clean.category || "pc_part",
    brand: clean.brand,
    model: clean.brand
      ? clean.canonicalName.split(clean.brand)[1]?.trim() || clean.canonicalName
      : clean.canonicalName,
    specs: Object.fromEntries(
      Object.entries(clean.specs)
        .filter(([_, v]) => typeof v === "string")
        .map(([k, v]) => [k, v as string])
    ),
    imageUrl: clean.imageUrl || null,
    listings: validListings,
    bestPrice: validListings[0]?.price || clean.bestPrice || 0,
    listingCount: validListings.length,
    bestStore: validListings[0]?.sourceName || "Unknown",
    bestLocation: validListings[0]?.location || "Algeria",
  };
}

export function useStaticData() {
  const [products, setProducts] = useState<ProcessedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (dataCache) {
        setProducts(dataCache.map(mapCleanToProcessed));
        setLoading(false);
        return;
      }

      try {
        // Try clean data first (deduplicated), fallback to raw data
        let res = await fetch("/clean-products.json");
        let data;
        if (!res.ok) {
          res = await fetch("/scrape-data.json");
          if (!res.ok) throw new Error("Failed to load data");
        }
        data = await res.json();
        const cleanProducts: CleanProduct[] = (data.products || []).filter((p: CleanProduct) => {
          return p.canonicalName?.length > 3 && p.canonicalName.length < 200 && p.bestPrice > 1000;
        });
        dataCache = cleanProducts;
        setProducts(cleanProducts.map(mapCleanToProcessed));
      } catch (e: any) {
        setError(e.message || "Failed to load product data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const search = useCallback(
    (query: string, category: string = "all"): ProcessedProduct[] => {
      const q = query.toLowerCase().trim();
      if (!q) return products.slice(0, 20);

      return products.filter((p) => {
        const matchesQuery =
          p.name.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false) ||
          Object.values(p.specs).some((v) => v.toLowerCase().includes(q));
        const matchesCategory = category === "all" || p.category === category;
        return matchesQuery && matchesCategory;
      });
    },
    [products]
  );

  const byCategory = useCallback(
    (category: string, limit: number = 20): ProcessedProduct[] => {
      return products.filter((p) => p.category === category).slice(0, limit);
    },
    [products]
  );

  const trending = useMemo(() => {
    return products.slice(0, 8);
  }, [products]);

  return { products, loading, error, search, byCategory, trending };
}
