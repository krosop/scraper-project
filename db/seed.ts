import { getDb } from "../server/queries/connection";
import {
  products,
  sources,
  listings,
  sellers,
  sellerListings,
} from "./schema";
import fs from "fs";
import path from "path";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Clean existing data
  await db.delete(listings);
  await db.delete(sellerListings);
  await db.delete(sellers);
  await db.delete(products);
  await db.delete(sources);

  console.log("Cleaned existing data");

  // Try to load scraped data
  let scrapedProducts: any[] = [];
  try {
    const resultsPath = path.join(__dirname, "../scripts/scrape-results.json");
    if (fs.existsSync(resultsPath)) {
      const data = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
      scrapedProducts = data.products || [];
      console.log(`Loaded ${scrapedProducts.length} scraped products`);
    }
  } catch (e) {
    console.log("No scraped data found, using sample data");
  }

  // Seed sources
  const sourceData = [
    { name: "CHB-Store", baseUrl: "https://chb-store.com", scrapeType: "axios" as const, categoryFocus: ["pc_part"], isActive: true },
    { name: "Africapap", baseUrl: "https://africapap.com", scrapeType: "axios" as const, categoryFocus: ["monitor", "accessory"], isActive: true },
    { name: "CapMicro Dz", baseUrl: "https://capmicrodz.com", scrapeType: "axios" as const, categoryFocus: ["pc_part"], isActive: true },
    { name: "DeskCom IT & Gaming", baseUrl: "https://deskcom-dz.com", scrapeType: "axios" as const, categoryFocus: ["pc_part"], isActive: true },
    { name: "AMI-DZ", baseUrl: "https://ami-dz.com", scrapeType: "axios" as const, categoryFocus: ["pc_part"], isActive: true },
    { name: "GigaStore DZ", baseUrl: "https://gigastore-dz.com", scrapeType: "axios" as const, categoryFocus: ["pc_part"], isActive: true },
    { name: "Mobolist", baseUrl: "https://mobolist.net", scrapeType: "axios" as const, categoryFocus: ["phone"], isActive: true },
    { name: "Ouedkniss", baseUrl: "https://ouedkniss.com", scrapeType: "playwright" as const, categoryFocus: ["phone", "pc_part", "laptop"], isActive: true },
  ];

  const insertedSources = await db.insert(sources).values(sourceData).returning();
  console.log(`Inserted ${insertedSources.length} sources`);

  // Create source name -> ID map
  const sourceMap: Record<string, string> = {};
  for (const s of insertedSources) sourceMap[s.name] = s.id;

  // Seed products from scraped data OR fallback to sample
  let productData: any[] = [];

  if (scrapedProducts.length > 0) {
    // Use real scraped data
    const seen = new Set<string>();
    for (const sp of scrapedProducts) {
      const key = sp.title.toLowerCase().trim();
      if (seen.has(key) || sp.title.includes("<img") || sp.title.includes("<div")) continue;
      seen.add(key);

      // Extract brand
      const brandMatch = sp.title.match(/^(ASUS|MSI|Gigabyte|AMD|Intel|NVIDIA|ZOTAC|Corsair|Cooler Master|Samsung|Apple|Xiaomi|ASRock|ColorFul|iNNO3D|SAPPHIRE|ANTEC|OCYPUS|DeepCool|AOC|MATOS|NEONIX|AGI|COOLER MASTER)/i);

      // Determine specs
      const specs: Record<string, string> = {};
      const t = sp.title.toLowerCase();
      if (t.includes("w ") || t.includes("watt")) specs.wattage = sp.title.match(/(\d+)\s*W/i)?.[1] + "W" || "";
      if (t.includes("gb") && t.includes("rtx")) specs.vram = sp.title.match(/(\d+)\s*GB/i)?.[1] + "GB" || "";
      if (t.includes("rx ")) specs.vram = sp.title.match(/(\d+)\s*GB/i)?.[1] + "GB" || "";
      if (t.includes("ddr")) specs.type = "DDR4/DDR5";

      productData.push({
        canonicalName: sp.title.replace(/\s+/g, " ").trim().substring(0, 200),
        category: sp.category || "pc_part",
        brand: brandMatch ? brandMatch[1] : null,
        model: sp.title.split("–")[1]?.trim() || sp.title.split("-")[0]?.trim(),
        specs,
        storeImageUrl: null,
        fallbackImageUrl: null,
        _sourceName: sp.source,
        _price: sp.price,
        _url: sp.url,
        _condition: sp.condition || "new",
        _location: sp.location || "Algeria",
      });
    }
  }

  // If not enough scraped data, add sample products
  if (productData.length < 10) {
    console.log("Adding sample products...");
    productData.push(
      { canonicalName: "iPhone 15 Pro Max 256GB", category: "phone" as const, brand: "Apple", model: "iPhone 15 Pro Max", specs: { storage: "256GB", ram: "8GB" }, _sourceName: "Mobolist", _price: 185000, _url: "#", _condition: "new", _location: "Alger" },
      { canonicalName: "Samsung Galaxy S24 Ultra 256GB", category: "phone" as const, brand: "Samsung", model: "Galaxy S24 Ultra", specs: { storage: "256GB", ram: "12GB" }, _sourceName: "Mobolist", _price: 195000, _url: "#", _condition: "new", _location: "Alger" },
      { canonicalName: "NVIDIA RTX 4060 8GB", category: "pc_part" as const, brand: "NVIDIA", model: "RTX 4060", specs: { vram: "8GB" }, _sourceName: "CHB-Store", _price: 62000, _url: "#", _condition: "new", _location: "Alger" },
      { canonicalName: "AMD Ryzen 7 7800X3D", category: "pc_part" as const, brand: "AMD", model: "Ryzen 7 7800X3D", specs: { cores: "8", threads: "16" }, _sourceName: "DeskCom IT & Gaming", _price: 48000, _url: "#", _condition: "new", _location: "Alger" },
      { canonicalName: "Lenovo ThinkPad T14s", category: "laptop" as const, brand: "Lenovo", model: "ThinkPad T14s", specs: { cpu: "Ryzen 7", ram: "16GB" }, _sourceName: "AMI-DZ", _price: 145000, _url: "#", _condition: "new", _location: "Alger" },
    );
  }

  // Limit to top products by relevance
  productData = productData.slice(0, 150);
  console.log(`Seeding ${productData.length} products`);

  const insertedProducts = await db.insert(products).values(
    productData.map(p => ({
      canonicalName: p.canonicalName,
      category: p.category,
      brand: p.brand,
      model: p.model,
      specs: p.specs,
      storeImageUrl: null,
      fallbackImageUrl: null,
    }))
  ).returning();
  console.log(`Inserted ${insertedProducts.length} products`);

  // Create product title -> ID map
  const productMap: Record<string, string> = {};
  for (let i = 0; i < insertedProducts.length; i++) {
    const key = productData[i].canonicalName.toLowerCase().trim();
    productMap[key] = insertedProducts[i].id;
  }

  // Seed listings
  const listingData: any[] = [];
  for (let i = 0; i < productData.length; i++) {
    const pd = productData[i];
    const pid = insertedProducts[i]?.id;
    const sid = sourceMap[pd._sourceName];
    if (!pid || !sid) continue;

    listingData.push({
      productId: pid,
      sourceId: sid,
      title: pd.canonicalName,
      price: pd._price,
      condition: pd._condition as "new" | "used" | "refurbished",
      location: pd._location,
      url: pd._url || "#",
      isAvailable: true,
      status: "fresh" as const,
      scrapedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }

  if (listingData.length > 0) {
    const insertedListings = await db.insert(listings).values(listingData).returning();
    console.log(`Inserted ${insertedListings.length} listings`);
  }

  // Seed sample sellers
  const sellerData = [
    { storeName: "Tech Store Alger", wilaya: "Alger", phone: "0550123456", whatsapp: "0550123456", email: "contact@techstorealger.dz", isVerified: true },
    { storeName: "PC Parts Oran", wilaya: "Oran", phone: "0551987654", whatsapp: "0551987654", isVerified: false },
  ];

  const insertedSellers = await db.insert(sellers).values(sellerData).returning();
  console.log(`Inserted ${insertedSellers.length} sellers`);

  // Seed sample seller listings
  const sellerListingData = [
    { sellerId: insertedSellers[0].id, productName: "iPhone 14 Pro 128GB", category: "phone" as const, price: 125000, condition: "used" as const, description: "iPhone 14 Pro en excellent etat. Batterie 92%.", expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
    { sellerId: insertedSellers[0].id, productName: "RTX 3070 Ti 8GB", category: "pc_part" as const, price: 45000, condition: "used" as const, description: "Carte graphique en parfait etat de marche.", expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    { sellerId: insertedSellers[1].id, productName: "Dell Latitude 5520 i5 11th", category: "laptop" as const, price: 68000, condition: "used" as const, description: "PC portable pro. 16GB RAM, 512GB SSD.", expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000) },
  ];

  await db.insert(sellerListings).values(sellerListingData);
  console.log(`Inserted ${sellerListingData.length} seller listings`);

  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
