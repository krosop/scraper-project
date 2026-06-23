import { useState, useEffect, useMemo, useCallback } from "react";

export interface ScrapedProduct {
  source: string;
  title: string;
  price: number;
  url: string;
  imageUrl?: string | null;
  category: string;
  location: string;
  condition: string;
}

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

let dataCache: ScrapedProduct[] | null = null;

function generateId(prefix: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const absHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `${prefix}-${absHash}`;
}

function cleanTitle(title: string): string {
  let cleaned = title.replace(/<[^>]+>/g, "");
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length > 200) cleaned = cleaned.substring(0, 200);
  return cleaned;
}

function extractBrand(title: string): string | null {
  const brands = [
    "ASUS", "MSI", "Gigabyte", "AMD", "Intel", "NVIDIA", "ZOTAC",
    "Corsair", "Cooler Master", "Samsung", "Apple", "ASRock",
    "ColorFul", "iNNO3D", "SAPPHIRE", "ANTEC", "OCYPUS", "DeepCool",
    "AOC", "MATOS", "NEONIX", "AGI", "Lenovo", "Dell",
    "HP", "Acer", "LG", "Logitech", "HyperX", "SteelSeries", "Razer",
    "Crucial", "Kingston", "Western Digital", "WD", "Seagate", "Noctua",
  ];
  const upper = title.toUpperCase();
  for (const brand of brands) {
    if (upper.includes(brand.toUpperCase())) return brand;
  }
  return null;
}

function extractSpecs(title: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const t = title.toLowerCase();
  const wattMatch = title.match(/(\d+)\s*[Ww]\b/);
  if (wattMatch) specs.wattage = wattMatch[1] + "W";
  const vramMatch = title.match(/(\d+)\s*GB/);
  if (vramMatch && (t.includes("rtx") || t.includes("gtx") || t.includes("rx "))) {
    specs.vram = vramMatch[1] + "GB";
  }
  if (t.includes("ddr5")) specs.memory = "DDR5";
  else if (t.includes("ddr4")) specs.memory = "DDR4";
  if (t.includes("nvme")) specs.interface = "NVMe";
  return specs;
}

function processProducts(scraped: ScrapedProduct[]): ProcessedProduct[] {
  const groups: Record<string, ScrapedProduct[]> = {};
  for (const p of scraped) {
    const cleaned = cleanTitle(p.title);
    const key = cleaned.toLowerCase();
    if (!key || key.length < 3) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const processed: ProcessedProduct[] = [];
  for (const [key, items] of Object.entries(groups)) {
    const first = items[0];
    const cleanedTitle = cleanTitle(first.title);
    const brand = extractBrand(cleanedTitle);
    const specs = extractSpecs(cleanedTitle);

    const productListings: ProductListing[] = items.map((item, idx) => ({
      id: generateId("lst", `${key}-${idx}`),
      price: item.price,
      condition: item.condition || "new",
      location: item.location || "Algeria",
      url: item.url,
      sourceName: item.source,
      sourceType: "axios",
      scrapedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      imageUrl: null,
    }));

    productListings.sort((a, b) => a.price - b.price);

    processed.push({
      id: generateId("prd", key),
      name: cleanedTitle,
      category: first.category || "pc_part",
      brand,
      model: brand ? cleanedTitle.split(brand)[1]?.trim() || cleanedTitle : cleanedTitle,
      specs,
      imageUrl: first.imageUrl || null,
      listings: productListings,
      bestPrice: productListings[0]?.price || 0,
      listingCount: productListings.length,
      bestStore: productListings[0]?.sourceName || "Unknown",
      bestLocation: productListings[0]?.location || "Algeria",
    });
  }

  processed.sort((a, b) => b.listingCount - a.listingCount);
  return processed;
}

export function useStaticData() {
  const [products, setProducts] = useState<ProcessedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (dataCache) {
        setProducts(processProducts(dataCache));
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/scrape-data.json");
        if (!res.ok) throw new Error("Failed to load data");
        const data = await res.json();
        const scraped: ScrapedProduct[] = (data.products || []).filter((p: ScrapedProduct) => {
          const cleaned = cleanTitle(p.title);
          return cleaned.length > 3 && cleaned.length < 200 && p.price > 1000 && !cleaned.includes("<img");
        });
        dataCache = scraped;
        setProducts(processProducts(scraped));
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

  const getById = useCallback(
    (id: string): ProcessedProduct | undefined => {
      return products.find((p) => p.id === id);
    },
    [products]
  );

  const trending = useMemo(
    () => [
      { query: "rtx 4060", count: 42 },
      { query: "alimentation 750w", count: 28 },
      { query: "ryzen 7", count: 35 },
      { query: "ecran 27", count: 19 },
      { query: "rtx 4070", count: 31 },
      { query: "carte mere", count: 22 },
      { query: "ssd nvme", count: 17 },
      { query: "ddr5", count: 15 },
    ],
    []
  );

  return { products, loading, error, search, byCategory, getById, trending };
}
