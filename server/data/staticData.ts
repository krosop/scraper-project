import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cleaned data format (from clean-products.cjs)
interface CleanProduct {
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

// Frontend/server format
export interface ProcessedProduct {
  id: string;
  canonicalName: string;
  category: string;
  brand: string | null;
  model: string | null;
  specs: Record<string, string>;
  imageUrl: string | null;
  listings: ProductListing[];
  bestPrice: number;
  listingCount: number;
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

interface SourceInfo {
  id: string;
  name: string;
  baseUrl: string;
  categoryFocus: string[];
  isActive: boolean;
}

let productsCache: ProcessedProduct[] | null = null;
let sourcesCache: SourceInfo[] | null = null;

function generateId(prefix: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const absHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `${prefix}-${absHash}`;
}

function loadCleanData(): CleanProduct[] {
  try {
    // Try clean data first, fallback to raw
    const cleanPath = path.join(__dirname, "clean-products.json");
    const rawPath = path.join(__dirname, "scrape-results.json");
    
    let filePath = cleanPath;
    if (!fs.existsSync(cleanPath)) {
      filePath = rawPath;
    }
    if (!fs.existsSync(filePath)) return [];

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const products: CleanProduct[] = data.products || [];
    
    return products.filter((p) => {
      return p.canonicalName?.length > 3 && p.canonicalName.length < 200 && p.bestPrice > 1000;
    });
  } catch {
    return [];
  }
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

  const validListings = listings.filter(l => l.url && l.url.length > 5);

  return {
    id: clean.id,
    canonicalName: clean.canonicalName,
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
  };
}

export function getSources(): SourceInfo[] {
  if (sourcesCache) return sourcesCache;

  const products = loadCleanData();
  const sourceNames = [...new Set(products.flatMap(p => p.listings.map(l => l.source)))];

  const sourceUrls: Record<string, string> = {
    "CHB-Store": "https://chb-store.com",
    Africapap: "https://africapap.com",
    "CapMicro Dz": "https://capmicrodz.com",
    "DeskCom IT & Gaming": "https://deskcom-dz.com",
    "AMI-DZ": "https://ami-dz.com",
    "GigaStore DZ": "https://gigastore-dz.com",
  };

  sourcesCache = sourceNames.map((name) => ({
    id: generateId("src", name),
    name,
    baseUrl: sourceUrls[name] || "#",
    categoryFocus: ["pc_part"],
    isActive: true,
  }));

  return sourcesCache;
}

export function getStaticProducts(): ProcessedProduct[] {
  if (productsCache) return productsCache;

  const cleanProducts = loadCleanData();
  const processed = cleanProducts.map(mapCleanToProcessed);
  
  // Sort by popularity (most listings first)
  processed.sort((a, b) => b.listingCount - a.listingCount);
  
  productsCache = processed;
  return processed;
}

export function searchStaticProducts(
  query: string,
  category: string = "all"
): ProcessedProduct[] {
  const all = getStaticProducts();
  const q = query.toLowerCase().trim();

  return all.filter((p) => {
    const matchesQuery =
      p.canonicalName.toLowerCase().includes(q) ||
      (p.brand?.toLowerCase().includes(q) ?? false) ||
      Object.values(p.specs).some((v) => v.toLowerCase().includes(q));

    const matchesCategory = category === "all" || p.category === category;

    return matchesQuery && matchesCategory;
  });
}

export function getStaticProductById(id: string): ProcessedProduct | undefined {
  return getStaticProducts().find((p) => p.id === id);
}

export function getStaticProductsByCategory(
  category: string,
  limit: number = 20,
  offset: number = 0
): ProcessedProduct[] {
  const all = getStaticProducts().filter((p) => p.category === category);
  return all.slice(offset, offset + limit);
}

export function getStaticTrending(): { query: string; count: number }[] {
  return [
    { query: "rtx 4060", count: 42 },
    { query: "alimentation 750w", count: 28 },
    { query: "ryzen 7", count: 35 },
    { query: "ecran 27", count: 19 },
    { query: "rtx 4070", count: 31 },
    { query: "carte mere", count: 22 },
    { query: "ssd nvme", count: 17 },
    { query: "ddr5", count: 15 },
  ];
}

// Reset cache (useful for dev/hot reload)
export function resetStaticCache() {
  productsCache = null;
  sourcesCache = null;
}
