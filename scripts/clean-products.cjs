/**
 * Deal Finder DZ — Product Deduplication & Normalization (Option A: Free Fuzzy Matching)
 * 
 * This script cleans scraped products by:
 * 1. Fuzzy deduplication — groups similar titles using similarity algorithm
 * 2. Title normalization — removes store fluff, standardizes format
 * 3. Brand extraction — identifies and normalizes brand names
 * 4. Spec extraction — pulls specs from titles (VRAM, wattage, size, etc.)
 * 5. Category refinement — re-categorizes based on actual title content
 * 6. Price validation — removes outliers, picks best price per listing
 */

const fs = require("fs");
const path = require("path");

// ─── Configuration ───
const SIMILARITY_THRESHOLD = 0.65; // 65% similarity to group as same product
const MAX_TITLE_LENGTH = 120;

// ─── Known Brand Normalization Map ───
const BRAND_ALIASES = {
  "gigabyte": "Gigabyte",
  "geforce": "NVIDIA",
  "nvidia": "NVIDIA",
  "asus": "ASUS",
  "msi": "MSI",
  "asrock": "ASRock",
  "zotac": "ZOTAC",
  "sapphire": "SAPPHIRE",
  "powercolor": "PowerColor",
  "xfx": "XFX",
  "intel": "Intel",
  "amd": "AMD",
  "ryzen": "AMD",
  "core i": "Intel",
  "corsair": "Corsair",
  "cooler master": "Cooler Master",
  "thermaltake": "Thermaltake",
  "evga": "EVGA",
  "antec": "Antec",
  "deepcool": "DeepCool",
  "noctua": "Noctua",
  "be quiet": "be quiet!",
  "fractal": "Fractal Design",
  "phanteks": "Phanteks",
  "nzxt": "NZXT",
  "logitech": "Logitech",
  "razer": "Razer",
  "steelseries": "SteelSeries",
  "hyperx": "HyperX",
  "roccat": "ROCCAT",
  "aoc": "AOC",
  "lg": "LG",
  "samsung": "Samsung",
  "dell": "Dell",
  "hp": "HP",
  "lenovo": "Lenovo",
  "acer": "Acer",
  "philips": "Philips",
  "viewsonic": "ViewSonic",
  "benq": "BenQ",
  "crucial": "Crucial",
  "kingston": "Kingston",
  "g.skill": "G.Skill",
  "teamgroup": "TeamGroup",
  "adata": "ADATA",
  "patriot": "Patriot",
  "western digital": "Western Digital",
  "wd": "Western Digital",
  "seagate": "Seagate",
  "toshiba": "Toshiba",
  "sandisk": "SanDisk",
  "samsung": "Samsung",
  "apple": "Apple",
  "iphone": "Apple",
  "macbook": "Apple",
  "xiaomi": "Xiaomi",
  "redmi": "Xiaomi",
  "poco": "Xiaomi",
  "realme": "Realme",
  "oppo": "OPPO",
  "vivo": "Vivo",
  "oneplus": "OnePlus",
  "google": "Google",
  "pixel": "Google",
  "nokia": "Nokia",
  "motorola": "Motorola",
  "honor": "HONOR",
  "huawei": "Huawei",
  "sony": "Sony",
  "playstation": "Sony",
  "xbox": "Microsoft",
  "microsoft": "Microsoft",
  "nintendo": "Nintendo",
};

// ─── Store Name Fluff to Remove ───
const STORE_FLAFF = [
  /dz$/i, /dz\s+/i, /dz\b/i,
  /algerie/i, /algeria/i, /dzair/i,
  /store/i, /shop/i, /market/i, /boutique/i,
  /gamme/i, /series/i, /collection/i,
  /nouveau/i, /new/i, /neuf/i, /occasion/i,
  /promo/i, /solde/i, /discount/i, /offre/i,
  /en stock/i, /disponible/i, /livraison/i,
  /best price/i, /meilleur prix/i,
  /acheter/i, /buy/i, /commande/i,
  /pc gamer/i, /gaming/i, /pro/i, /ultra/i,
  /setup/i, /config/i, /build/i,
  /⭐/g, /✅/g, /🔥/g, /💯/g, /🎮/g, /🖥️/g, /💻/g,
  /\bnull\b/gi, /\bundefined\b/gi,
];

// ─── Simple Levenshtein Distance for Fuzzy Matching ───
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function similarity(str1, str2) {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(s1, s2);
  return 1 - dist / maxLen;
}

// ─── Title Normalization ───
function normalizeTitle(title) {
  let cleaned = title
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Remove store fluff
  for (const pattern of STORE_FLAFF) {
    cleaned = cleaned.replace(pattern, "");
  }
  
  // Remove extra whitespace after removing fluff
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[\-\|\/\\,\.]+$/, "").trim();
  
  // Truncate if too long
  if (cleaned.length > MAX_TITLE_LENGTH) {
    cleaned = cleaned.substring(0, MAX_TITLE_LENGTH).replace(/\s+\S*$/, "");
  }
  
  return cleaned;
}

// ─── Extract Brand ───
function extractBrand(title) {
  const lower = title.toLowerCase();
  for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

// ─── Extract Specs from Title ───
function extractSpecs(title) {
  const specs = {};
  const t = title.toLowerCase();
  
  // GPU model (e.g., RTX 4070, RX 7900 XT)
  const gpuMatch = title.match(/\b(RTX|GTX|RX)\s*(\d{3,4}\s*(?:Ti|XT|Super|S)?)\b/i);
  if (gpuMatch) {
    specs.gpu = `${gpuMatch[1].toUpperCase()} ${gpuMatch[2].trim()}`;
  }
  
  // CPU model (e.g., Ryzen 7 7800X3D, Core i9-14900K)
  const cpuMatch = title.match(/\b(Ryzen\s*\d\s*(?:\d{4}[A-Z]*)|Core\s*i\d(?:-\d+[A-Z]*)?)\b/i);
  if (cpuMatch) {
    specs.cpu = cpuMatch[1].trim();
  }
  
  // Motherboard chipset (e.g., B650, Z790, X670)
  const chipsetMatch = title.match(/\b(B\d{3}|Z\d{3}|X\d{3}|H\d{3}|A\d{20})\b/i);
  if (chipsetMatch) {
    specs.chipset = chipsetMatch[1].toUpperCase();
  }
  
  // RAM size (e.g., 32GB, 16 Go)
  const ramMatch = title.match(/(\d{1,3})\s*(?:GB|Go|Gb)\b/i);
  if (ramMatch && !t.includes("ssd") && !t.includes("nvme") && !t.includes("hdd")) {
    specs.ram = `${ramMatch[1]}GB`;
  }
  
  // SSD/HDD size (e.g., 1TB, 2 To, 500GB)
  const storageMatch = title.match(/(\d+(?:\.\d+)?)\s*(?:TB|To|GB|Go)\b/i);
  if (storageMatch) {
    const size = parseFloat(storageMatch[1]);
    const unit = storageMatch[0].toLowerCase().includes("t") ? "TB" : "GB";
    specs.storage = `${size}${unit}`;
  }
  
  // Wattage (e.g., 750W, 850 W)
  const wattMatch = title.match(/(\d{3,4})\s*[Ww]\b/);
  if (wattMatch) {
    specs.wattage = `${wattMatch[1]}W`;
  }
  
  // Screen size (e.g., 27", 24.5 inch, 32)
  const screenMatch = title.match(/(\d{1,2}(?:\.\d)?)\s*(?:"|inch|pouces?|\b)/i);
  if (screenMatch) {
    specs.screen = `${screenMatch[1]}"`;
  }
  
  // Refresh rate (e.g., 165Hz, 240 Hz, 144hz)
  const refreshMatch = title.match(/(\d{2,3})\s*[Hh]z\b/);
  if (refreshMatch) {
    specs.refreshRate = `${refreshMatch[1]}Hz`;
  }
  
  // Resolution (e.g., 1440p, 4K, 1080p, UHD)
  const resMatch = title.match(/\b(4K|UHD|QHD|FHD|1080p|1440p|2K|8K)\b/i);
  if (resMatch) {
    specs.resolution = resMatch[1].toUpperCase();
  }
  
  // DDR generation
  if (t.includes("ddr5")) specs.memory = "DDR5";
  else if (t.includes("ddr4")) specs.memory = "DDR4";
  
  // Panel type (e.g., IPS, OLED, VA, TN)
  const panelMatch = title.match(/\b(IPS|OLED|VA|TN|Mini[-\s]?LED)\b/i);
  if (panelMatch) {
    specs.panel = panelMatch[1].toUpperCase().replace("-", "").replace(" ", "");
  }
  
  // SSD interface
  if (t.includes("nvme")) specs.interface = "NVMe";
  else if (t.includes("sata")) specs.interface = "SATA";
  else if (t.includes("m.2") || t.includes("m2")) specs.interface = "M.2";
  
  // Case size (e.g., ATX, Micro-ATX, Mini-ITX)
  const caseMatch = title.match(/\b(ATX|Micro[-\s]?ATX|Mini[-\s]?ITX|E[-\s]?ATX)\b/i);
  if (caseMatch) {
    specs.formFactor = caseMatch[1].toUpperCase().replace("-", "").replace(" ", "");
  }
  
  // Color
  const colorMatch = title.match(/\b(Blanc|Noir|Rouge|Bleu|Vert|Jaune|Gris|Noir\/Blanc|White|Black|Red|Blue|Green|Yellow|Grey|Silver|Gold)\b/i);
  if (colorMatch) {
    const colorMap = {
      blanc: "White", white: "White",
      noir: "Black", black: "Black",
      rouge: "Red", red: "Red",
      bleu: "Blue", blue: "Blue",
      vert: "Green", green: "Green",
      jaune: "Yellow", yellow: "Yellow",
      gris: "Grey", grey: "Grey", gray: "Grey",
      silver: "Silver", gold: "Gold",
    };
    specs.color = colorMap[colorMatch[1].toLowerCase()] || colorMatch[1];
  }
  
  // Wireless
  if (t.includes("wireless") || t.includes("sans fil") || t.includes("bluetooth")) {
    specs.wireless = true;
  }
  
  // RGB
  if (t.includes("rgb") || t.includes("argb") || t.includes("aura") || t.includes("mystic light")) {
    specs.rgb = true;
  }
  
  return specs;
}

// ─── Refined Category Detection ───
function refinedCategory(title, originalCategory) {
  const t = title.toLowerCase();
  
  // Phone
  if (t.includes("iphone") || t.includes("samsung") || t.includes("xiaomi") || 
      t.includes("redmi") || t.includes("poco") || t.includes("realme") || 
      t.includes("oppo") || t.includes("vivo") || t.includes("oneplus") || 
      t.includes("pixel") || t.includes("nokia") || t.includes("motorola") || 
      t.includes("honor") || t.includes("huawei") || t.includes("sony xperia") ||
      /\b(smartphone|phone|gsm|mobile)\b/.test(t)) {
    return "phone";
  }
  
  // Monitor
  if (t.includes("ecran") || t.includes("monitor") || t.includes("moniteur") || 
      t.includes("display") || t.includes("oled") || t.includes("qhd") || 
      t.includes("1440p") || t.includes("4k") || t.includes("uhd") || 
      t.includes("fhd") || t.includes("1080p") || 
      /\b(\d{1,2}(?:\.\d)?\s*")/.test(title) && 
      (t.includes("hz") || t.includes("ips") || t.includes("va") || t.includes("oled"))) {
    return "monitor";
  }
  
  // Laptop
  if (t.includes("laptop") || t.includes("pc portable") || t.includes("notebook") || 
      t.includes("macbook") || t.includes("ultrabook") || 
      t.includes("gaming portable") || t.includes("portable gamer")) {
    return "laptop";
  }
  
  // Accessory (peripherals, not core PC parts)
  if (t.includes("souris") || t.includes("clavier") || t.includes("keyboard") || 
      t.includes("mouse") || t.includes("headset") || t.includes("casque") || 
      t.includes("microphone") || t.includes("webcam") || t.includes("hub") || 
      t.includes("pad") || t.includes("tapis") || t.includes("stand") || 
      t.includes("support") || t.includes("cable") || t.includes("adaptateur") || 
      t.includes("adapter") || t.includes("sac") || t.includes("bag") || 
      t.includes("chargeur") || t.includes("charger") || t.includes("batterie") || 
      t.includes("power bank") || t.includes("enceinte") || t.includes("speaker") ||
      t.includes("manette") || t.includes("controller") || t.includes("joystick")) {
    return "accessory";
  }
  
  // PC Part (GPU, CPU, motherboard, RAM, PSU, case, cooler, SSD)
  if (t.includes("rtx") || t.includes("gtx") || t.includes("rx ") || t.includes("radeon") || 
      t.includes("carte graphique") || t.includes("gpu") || t.includes("graphics card") ||
      t.includes("processeur") || t.includes("ryzen") || t.includes("core i") || 
      t.includes("intel") || t.includes("cpu") || t.includes("processor") ||
      t.includes("carte mere") || t.includes("carte mère") || t.includes("motherboard") || 
      t.includes("boitier") || t.includes("boîtier") || t.includes("case") || 
      t.includes("alimentation") || t.includes("psu") || t.includes("power supply") || 
      t.includes("watercooling") || t.includes("water cooling") || t.includes("refroidisseur") || 
      t.includes("cooler") || t.includes("ventirad") || t.includes("aio") || 
      t.includes("ram") || t.includes("ddr") || t.includes("mémoire") || 
      t.includes("ssd") || t.includes("nvme") || t.includes("hdd") || 
      t.includes("disque dur") || t.includes("m.2") || t.includes("ventilateur") || 
      t.includes("fan") || t.includes("pate thermique") || t.includes("pâte thermique") || 
      t.includes("thermal paste") || t.includes("pc gamer") || t.includes("pc fixe") || 
      t.includes("prebuilt") || t.includes("config")) {
    return "pc_part";
  }
  
  return originalCategory || "pc_part";
}

// ─── Price Outlier Detection ───
function removePriceOutliers(items) {
  if (items.length < 3) return items;
  
  const prices = items.map(i => i.price).sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)];
  const q3 = prices[Math.floor(prices.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return items.filter(i => i.price >= lowerBound && i.price <= upperBound);
}

// ─── Main Deduplication Engine ───
function deduplicateProducts(products) {
  console.log(`\n🧹 Cleaning ${products.length} products...\n`);
  
  // Step 1: Normalize each product
  const normalized = products.map(p => {
    const cleanTitle = normalizeTitle(p.title);
    const brand = extractBrand(cleanTitle) || extractBrand(p.title);
    const specs = extractSpecs(cleanTitle);
    const category = refinedCategory(cleanTitle, p.category);
    
    return {
      ...p,
      cleanTitle,
      brand,
      specs,
      category,
      searchKey: cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, ""),
    };
  }).filter(p => p.cleanTitle.length > 3 && p.price > 1000);
  
  console.log(`  ✓ Normalized: ${normalized.length} products`);
  
  // Step 2: Group by fuzzy similarity
  const groups = [];
  const used = new Set();
  
  for (let i = 0; i < normalized.length; i++) {
    if (used.has(i)) continue;
    
    const group = [normalized[i]];
    used.add(i);
    
    for (let j = i + 1; j < normalized.length; j++) {
      if (used.has(j)) continue;
      
      // Quick pre-filter: same brand or same category
      const sameBrand = normalized[i].brand && normalized[j].brand && 
        normalized[i].brand === normalized[j].brand;
      const sameCategory = normalized[i].category === normalized[j].category;
      
      // If same brand and category, check similarity
      if (sameBrand && sameCategory) {
        const sim = similarity(normalized[i].cleanTitle, normalized[j].cleanTitle);
        if (sim >= SIMILARITY_THRESHOLD) {
          group.push(normalized[j]);
          used.add(j);
        }
      }
      // If same GPU model, group together regardless of similarity
      else if (normalized[i].specs.gpu && normalized[j].specs.gpu && 
               normalized[i].specs.gpu === normalized[j].specs.gpu) {
        group.push(normalized[j]);
        used.add(j);
      }
      // If same CPU model, group together
      else if (normalized[i].specs.cpu && normalized[j].specs.cpu && 
               normalized[i].specs.cpu === normalized[j].specs.cpu) {
        group.push(normalized[j]);
        used.add(j);
      }
    }
    
    groups.push(group);
  }
  
  console.log(`  ✓ Grouped into ${groups.length} unique products`);
  
  // Step 3: Merge each group into a canonical product
  const canonicalProducts = groups.map((group, idx) => {
    // Pick the cleanest title (shortest, most complete)
    const bestTitle = group.reduce((best, current) => {
      const bestScore = best.cleanTitle.length + (best.brand ? 0 : 10);
      const currentScore = current.cleanTitle.length + (current.brand ? 0 : 10);
      return currentScore < bestScore ? current : best;
    });
    
    // Merge specs (take first non-empty for each)
    const mergedSpecs = {};
    for (const item of group) {
      for (const [key, value] of Object.entries(item.specs)) {
        if (value && !mergedSpecs[key]) {
          mergedSpecs[key] = value;
        }
      }
    }
    
    // Remove price outliers and sort by price
    const cleanListings = removePriceOutliers(group).sort((a, b) => a.price - b.price);
    
    // Deduplicate listings by URL (same URL = same listing)
    const seenUrls = new Set();
    const uniqueListings = cleanListings.filter(l => {
      if (seenUrls.has(l.url)) return false;
      seenUrls.add(l.url);
      return true;
    });
    
    return {
      id: `prd-${idx}-${Date.now().toString(36).slice(-4)}`,
      canonicalName: bestTitle.cleanTitle,
      originalTitle: group[0].title,
      brand: bestTitle.brand,
      category: bestTitle.category,
      specs: mergedSpecs,
      imageUrl: group.find(g => g.imageUrl)?.imageUrl || null,
      bestPrice: uniqueListings[0]?.price || 0,
      worstPrice: uniqueListings[uniqueListings.length - 1]?.price || 0,
      averagePrice: Math.round(uniqueListings.reduce((s, l) => s + l.price, 0) / uniqueListings.length),
      listingCount: uniqueListings.length,
      storeCount: new Set(uniqueListings.map(l => l.source)).size,
      listings: uniqueListings.map(l => ({
        source: l.source,
        price: l.price,
        condition: l.condition,
        location: l.location,
        url: l.url,
        imageUrl: l.imageUrl || null,
      })),
    };
  });
  
  // Sort by popularity (most listings first)
  canonicalProducts.sort((a, b) => b.listingCount - a.listingCount);
  
  console.log(`  ✓ Deduplicated: ${canonicalProducts.length} unique products`);
  console.log(`  ✓ Removed ${normalized.length - canonicalProducts.length} duplicates`);
  console.log(`  ✓ Price range: ${canonicalProducts[0]?.bestPrice || 0} - ${canonicalProducts[canonicalProducts.length - 1]?.bestPrice || 0} DZD\n`);
  
  return canonicalProducts;
}

// ─── Supabase Upload (cleaned data) ───
async function uploadCleanedToSupabase(products) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log("Supabase env vars not set, skipping upload");
    return 0;
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { persistSession: false },
      realtime: { enabled: false }
    });

    let inserted = 0;
    const batchSize = 25;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      for (const product of batch) {
        try {
          // Insert/upsert product
          const { data: prodData } = await supabase
            .from("products")
            .upsert({
              canonical_name: product.canonicalName,
              category: product.category,
              brand: product.brand,
              model: product.specs.gpu || product.specs.cpu || product.specs.chipset || null,
              specs: product.specs,
              store_image_url: product.imageUrl,
            }, { onConflict: "canonical_name" })
            .select("id")
            .single();
          
          if (!prodData?.id) continue;
          
          // Insert listings
          for (const listing of product.listings) {
            // Get source ID
            const { data: sourceData } = await supabase
              .from("sources")
              .select("id")
              .eq("name", listing.source)
              .limit(1);
            
            const sourceId = sourceData?.[0]?.id;
            if (!sourceId) continue;
            
            await supabase.from("listings").upsert({
              product_id: prodData.id,
              source_id: sourceId,
              title: product.canonicalName,
              price: listing.price,
              condition: listing.condition,
              location: listing.location,
              url: listing.url,
              image_url: listing.imageUrl,
              is_available: true,
              status: "fresh",
              scraped_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: "product_id,source_id,url" });
          }
          
          inserted++;
        } catch (e) {
          console.error(`  Failed: ${product.canonicalName}: ${e.message}`);
        }
      }
      
      if (i + batchSize < products.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    console.log(`\n✓ Uploaded ${inserted}/${products.length} clean products to Supabase`);
    return inserted;
  } catch (e) {
    console.error(`Supabase upload failed: ${e.message}`);
    return 0;
  }
}

// ─── MAIN ───
async function main() {
  const inputFile = process.argv[2] || path.join(__dirname, "scrape-results.json");
  const outputFile = process.argv[3] || path.join(__dirname, "clean-products.json");
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  DEAL FINDER DZ — Product Deduplication & Normalization`);
  console.log(`  Input:  ${inputFile}`);
  console.log(`  Output: ${outputFile}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  // Load scraped data
  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  } catch (e) {
    console.error(`Failed to load ${inputFile}: ${e.message}`);
    process.exit(1);
  }
  
  const products = rawData.products || rawData;
  console.log(`Loaded ${products.length} raw products\n`);
  
  // Deduplicate and normalize
  const cleanProducts = deduplicateProducts(products);
  
  // Save cleaned data
  const output = {
    timestamp: new Date().toISOString(),
    total: cleanProducts.length,
    stats: {
      originalCount: products.length,
      duplicateCount: products.length - cleanProducts.length,
      reductionRate: ((products.length - cleanProducts.length) / products.length * 100).toFixed(1) + "%",
    },
    products: cleanProducts,
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`✓ Saved cleaned data to ${outputFile}`);
  
  // Also save to public/ for frontend
  const publicFile = path.join(__dirname, "..", "public", "clean-products.json");
  fs.writeFileSync(publicFile, JSON.stringify(output, null, 2));
  console.log(`✓ Saved to public/clean-products.json`);
  
  // Print sample
  console.log(`\n📊 Sample Results:`);
  cleanProducts.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.canonicalName.substring(0, 60)}`);
    console.log(`     Brand: ${p.brand || "N/A"} | Category: ${p.category} | Listings: ${p.listingCount} | Best: ${p.bestPrice.toLocaleString()} DZD`);
    if (Object.keys(p.specs).length > 0) {
      console.log(`     Specs: ${JSON.stringify(p.specs)}`);
    }
  });
  
  // Upload to Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    console.log(`\n📤 Uploading to Supabase...`);
    await uploadCleanedToSupabase(cleanProducts);
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  DONE: ${cleanProducts.length} unique products saved`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
