import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScrapedProduct {
  source: string;
  title: string;
  price: number;
  url: string;
  category: string;
  location: string;
  condition: string;
  imageUrl?: string;
}

interface SourceInfo {
  id: string;
  name: string;
  baseUrl: string;
  categoryFocus: string[];
  isActive: boolean;
}

interface ProcessedProduct {
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

interface ProductListing {
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

let productsCache: ProcessedProduct[] | null = null;
let sourcesCache: SourceInfo[] | null = null;

const EXTRACTED_BRANDS = [
  "ASUS", "MSI", "Gigabyte", "AMD", "Intel", "NVIDIA", "ZOTAC",
  "Corsair", "Cooler Master", "Samsung", "Apple", "Xiaomi", "ASRock",
  "ColorFul", "iNNO3D", "SAPPHIRE", "ANTEC", "OCYPUS", "DeepCool",
  "AOC", "MATOS", "NEONIX", "AGI", "COOLER MASTER", "Lenovo", "Dell",
  "HP", "Acer", "LG", "Logitech", "HyperX", "SteelSeries", "Razer",
  "Crucial", "Kingston", "Western Digital", "WD", "Seagate", "Noctua",
  "Be Quiet!", "Thermaltake", "EVGA", "MSI", "PNY", "Palit",
];

function cleanTitle(title: string): string {
  // Remove HTML tags
  let cleaned = title.replace(/<[^>]+>/g, "");
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "");
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // Truncate reasonable length
  if (cleaned.length > 200) cleaned = cleaned.substring(0, 200);
  return cleaned;
}

function extractBrand(title: string): string | null {
  const upper = title.toUpperCase();
  for (const brand of EXTRACTED_BRANDS) {
    if (upper.includes(brand.toUpperCase())) {
      return brand;
    }
  }
  return null;
}

function extractSpecs(title: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const t = title.toLowerCase();

  // Wattage
  const wattMatch = title.match(/(\d+)\s*[Ww]\b/);
  if (wattMatch) specs.wattage = wattMatch[1] + "W";

  // VRAM
  const vramMatch = title.match(/(\d+)\s*GB/);
  if (vramMatch && (t.includes("rtx") || t.includes("gtx") || t.includes("rx "))) {
    specs.vram = vramMatch[1] + "GB";
  }

  // DDR
  if (t.includes("ddr5")) specs.memory = "DDR5";
  else if (t.includes("ddr4")) specs.memory = "DDR4";

  // SSD
  if (t.includes("nvme")) specs.interface = "NVMe";
  else if (t.includes("sata")) specs.interface = "SATA";

  // Screen size
  const screenMatch = title.match(/(\d+(?:\.\d+)?)\s*['\"]?/);
  if (screenMatch && (t.includes("ecran") || t.includes("monitor"))) {
    specs.screen = screenMatch[1] + "\"";
  }

  return specs;
}

function generateId(prefix: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const absHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `${prefix}-${absHash}-${Date.now().toString(36).slice(-4)}`;
}

function loadScrapedData(): ScrapedProduct[] {
  try {
    const filePath = path.join(__dirname, "scrape-results.json");
    if (!fs.existsSync(filePath)) return [];

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const products: ScrapedProduct[] = data.products || [];

    // Filter out products with invalid titles (HTML remnants)
    return products.filter((p) => {
      const cleaned = cleanTitle(p.title);
      return cleaned.length > 3 && cleaned.length < 200 && p.price > 1000;
    });
  } catch {
    return [];
  }
}

export function getSources(): SourceInfo[] {
  if (sourcesCache) return sourcesCache;

  const products = loadScrapedData();
  const sourceNames = [...new Set(products.map((p) => p.source))];

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

  const scraped = loadScrapedData();

  // Group by cleaned title
  const groups: Record<string, ScrapedProduct[]> = {};
  for (const p of scraped) {
    const cleaned = cleanTitle(p.title);
    const key = cleaned.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const processed: ProcessedProduct[] = [];

  for (const [key, items] of Object.entries(groups)) {
    const first = items[0];
    const cleanedTitle = cleanTitle(first.title);
    const brand = extractBrand(cleanedTitle);
    const specs = extractSpecs(cleanedTitle);

    const productListings: ProductListing[] = items.map((item, idx) => {
      return {
        id: generateId("lst", `${key}-${idx}`),
        price: item.price,
        condition: item.condition || "new",
        location: item.location || "Algeria",
        url: item.url,
        sourceName: item.source,
        sourceType: "axios",
        scrapedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        imageUrl: item.imageUrl || null,
      };
    });

    // Sort listings by price
    productListings.sort((a, b) => a.price - b.price);

    processed.push({
      id: generateId("prd", key),
      canonicalName: cleanedTitle,
      category: first.category || "pc_part",
      brand,
      model: brand ? cleanedTitle.split(brand)[1]?.trim() || cleanedTitle : cleanedTitle,
      specs,
      imageUrl: first.imageUrl || null,
      listings: productListings,
      bestPrice: productListings[0]?.price || 0,
      listingCount: productListings.length,
    });
  }

  // Sort by listing count (more listings = more popular)
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
