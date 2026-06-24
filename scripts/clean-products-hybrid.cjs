/**
 * Deal Finder DZ — Hybrid Cleaning (v1 deduplication + v2 spec extraction)
 * 
 * Best of both worlds:
 * - v1: Fuzzy deduplication (works great for Algerian store titles)
 * - v2: Spec extraction, brand normalization, category detection
 * - v1: Category refinement (better for Algerian data)
 */

const fs = require("fs");
const path = require("path");

// Load v2 engine for spec extraction and brand detection
require("./pcparts-engine-v2.js");
const PCPartsEngine = global.PCPartsEngine;

// ─── Configuration ───
const INPUT_FILE = process.argv[2] || path.join(__dirname, "scrape-results.json");
const OUTPUT_FILE = process.argv[3] || path.join(__dirname, "clean-products.json");
const SIMILARITY_THRESHOLD = 0.65;

// ─── v1: Levenshtein Distance for Fuzzy Matching ───
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

// ─── v1: Title Normalization ───
function normalizeTitle(title) {
  let cleaned = title
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Remove store fluff
  const fluff = [
    /dz$/i, /dz\s+/i, /algerie/i, /algeria/i, /dzair/i,
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
  
  for (const pattern of fluff) {
    cleaned = cleaned.replace(pattern, "");
  }
  
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/[\-\|\/\\,\.]+$/, "").trim();
  
  if (cleaned.length > 120) {
    cleaned = cleaned.substring(0, 120).replace(/\s+\S*$/, "");
  }
  
  return cleaned;
}

// ─── v2: Brand Extraction (comprehensive database) ───
function extractBrandV2(title) {
  if (PCPartsEngine) {
    const brand = PCPartsEngine.extractBrand(title);
    if (brand && brand !== "Unknown") return brand;
  }
  return null;
}

// ─── v2: Spec Extraction (detailed per category) ───
function extractSpecsV2(title, category) {
  if (PCPartsEngine) {
    return PCPartsEngine.extractSpecs(title, category);
  }
  return {};
}

// ─── v2: Category Detection (weighted scoring) ───
function detectCategoryV2(title) {
  if (PCPartsEngine) {
    const cat = PCPartsEngine.detectCategory(title, "");
    if (cat !== "unknown") return cat;
  }
  return null;
}

// ─── v1: Refined Category Detection (fallback) ───
function refinedCategory(title) {
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
  
  // Accessory
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
  
  // PC Part
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
  
  return "pc_part";
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

// ─── Main Deduplication (v1 fuzzy + v2 model identifiers) ───
function deduplicateProducts(products) {
  console.log(`\n🧹 Cleaning ${products.length} products...\n`);
  
  // Step 1: Normalize each product (v1 + v2 hybrid)
  const normalized = products.map(p => {
    const cleanTitle = normalizeTitle(p.title);
    const v2Category = detectCategoryV2(cleanTitle);
    const v1Category = refinedCategory(cleanTitle);
    const brand = extractBrandV2(cleanTitle) || extractBrandV2(p.title);
    const category = v2Category || v1Category;
    const specs = extractSpecsV2(cleanTitle, category);
    
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
  
  // Show category distribution
  const cats = {};
  for (const p of normalized) cats[p.category] = (cats[p.category] || 0) + 1;
  console.log(`  Categories:`, Object.entries(cats).map(([k, v]) => `${k}=${v}`).join(", "));
  
  // Step 2: Group by fuzzy similarity + model identifiers
  const groups = [];
  const used = new Set();
  
  for (let i = 0; i < normalized.length; i++) {
    if (used.has(i)) continue;
    
    const group = [normalized[i]];
    used.add(i);
    
    for (let j = i + 1; j < normalized.length; j++) {
      if (used.has(j)) continue;
      
      const sameBrand = normalized[i].brand && normalized[j].brand && 
        normalized[i].brand === normalized[j].brand;
      const sameCategory = normalized[i].category === normalized[j].category;
      
      let isMatch = false;
      
      // Try v2 model identifier matching first
      if (PCPartsEngine && sameBrand && sameCategory) {
        const idsA = PCPartsEngine.extractModelIdentifier(normalized[i].cleanTitle, normalized[i].category);
        const idsB = PCPartsEngine.extractModelIdentifier(normalized[j].cleanTitle, normalized[j].category);
        
        for (const idA of idsA) {
          for (const idB of idsB) {
            if (idA === idB || idA.includes(idB) || idB.includes(idA)) {
              isMatch = true;
              break;
            }
          }
          if (isMatch) break;
        }
      }
      
      // Fallback to v1 fuzzy matching
      if (!isMatch && sameBrand && sameCategory) {
        const sim = similarity(normalized[i].cleanTitle, normalized[j].cleanTitle);
        if (sim >= SIMILARITY_THRESHOLD) isMatch = true;
      }
      
      // Same GPU model (special case)
      if (!isMatch && normalized[i].specs.gpu && normalized[j].specs.gpu && 
          normalized[i].specs.gpu === normalized[j].specs.gpu) {
        isMatch = true;
      }
      
      // Same CPU model (special case)
      if (!isMatch && normalized[i].specs.cpu && normalized[j].specs.cpu && 
          normalized[i].specs.cpu === normalized[j].specs.cpu) {
        isMatch = true;
      }
      
      if (isMatch) {
        group.push(normalized[j]);
        used.add(j);
      }
    }
    
    groups.push(group);
  }
  
  console.log(`  ✓ Grouped into ${groups.length} unique products`);
  
  return groups;
}

// ─── Build Clean Products from Groups ───
function buildCleanProducts(groups) {
  const cleanProducts = [];
  
  for (const group of groups) {
    if (group.length === 0) continue;
    
    const bestTitle = group.reduce((best, current) => {
      const bestScore = best.cleanTitle.length + (best.brand ? 0 : 10);
      const currentScore = current.cleanTitle.length + (current.brand ? 0 : 10);
      return currentScore < bestScore ? current : best;
    });
    
    // Merge specs (v2 + v1 combined)
    const mergedSpecs = {};
    for (const item of group) {
      for (const [key, value] of Object.entries(item.specs)) {
        if (value && !mergedSpecs[key]) {
          mergedSpecs[key] = value;
        }
      }
    }
    
    const cleanListings = removePriceOutliers(group).sort((a, b) => a.price - b.price);
    
    const seenUrls = new Set();
    const uniqueListings = cleanListings.filter(l => {
      if (seenUrls.has(l.url)) return false;
      seenUrls.add(l.url);
      return true;
    });
    
    const prices = uniqueListings.map(l => l.price).filter(p => p > 0);
    
    cleanProducts.push({
      id: `prd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      canonicalName: bestTitle.cleanTitle,
      originalTitle: group[0].title,
      brand: bestTitle.brand,
      category: bestTitle.category,
      specs: mergedSpecs,
      imageUrl: group.find(g => g.imageUrl)?.imageUrl || null,
      bestPrice: prices.length > 0 ? Math.min(...prices) : 0,
      worstPrice: prices.length > 0 ? Math.max(...prices) : 0,
      averagePrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      listingCount: uniqueListings.length,
      storeCount: new Set(uniqueListings.map(l => l.source)).size,
      listings: uniqueListings.map(l => ({
        source: l.source,
        price: l.price,
        condition: l.condition || "new",
        location: l.location || "Algeria",
        url: l.url,
        imageUrl: l.imageUrl || null,
      })),
    });
  }
  
  cleanProducts.sort((a, b) => b.listingCount - a.listingCount);
  return cleanProducts;
}

// ─── Supabase Upload ───
async function uploadToSupabase(products) {
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
          
          for (const listing of product.listings) {
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
    
    console.log(`\n✓ Uploaded ${inserted}/${products.length} products to Supabase`);
    return inserted;
  } catch (e) {
    console.error(`Supabase upload failed: ${e.message}`);
    return 0;
  }
}

// ─── MAIN ───
async function main() {
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  DEAL FINDER DZ — Hybrid Cleaning (v1 + v2)`);
  console.log(`  v1: Fuzzy deduplication for Algerian data`);
  console.log(`  v2: Spec extraction + brand normalization`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  } catch (e) {
    console.error(`Failed to load ${INPUT_FILE}: ${e.message}`);
    process.exit(1);
  }
  
  const products = rawData.products || rawData;
  console.log(`Loaded ${products.length} raw products\n`);
  
  // Step 1: Normalize with hybrid approach
  console.log(`Step 1: Normalizing with v1 + v2 hybrid...`);
  
  // Step 2: Deduplicate with fuzzy + model matching
  const groups = deduplicateProducts(products);
  
  // Step 3: Build clean products
  console.log(`\nStep 2: Building clean product catalog...`);
  const cleanProducts = buildCleanProducts(groups);
  
  // Calculate stats
  const cats = {};
  for (const p of cleanProducts) cats[p.category] = (cats[p.category] || 0) + 1;
  const allPrices = cleanProducts.flatMap(p => p.listings.map(l => l.price)).filter(p => p > 0);
  
  console.log(`\n📊 Results:`);
  console.log(`  Raw products: ${products.length}`);
  console.log(`  Clean products: ${cleanProducts.length}`);
  console.log(`  Duplicates removed: ${products.length - cleanProducts.length}`);
  console.log(`  Reduction: ${((products.length - cleanProducts.length) / products.length * 100).toFixed(1)}%`);
  console.log(`  Average price: ${allPrices.length > 0 ? Math.round(allPrices.reduce((a,b) => a+b, 0) / allPrices.length).toLocaleString() : 0} DZD`);
  console.log(`  Price range: ${allPrices.length > 0 ? Math.min(...allPrices).toLocaleString() : 0} - ${allPrices.length > 0 ? Math.max(...allPrices).toLocaleString() : 0} DZD`);
  console.log(`\n  Category breakdown:`);
  Object.entries(cats).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`    ${k}: ${v} (${(v / cleanProducts.length * 100).toFixed(1)}%)`);
  });

  // Save output
  const output = {
    timestamp: new Date().toISOString(),
    total: cleanProducts.length,
    stats: {
      originalCount: products.length,
      cleanCount: cleanProducts.length,
      duplicateCount: products.length - cleanProducts.length,
      reductionRate: `${((products.length - cleanProducts.length) / products.length * 100).toFixed(1)}%`,
      averagePrice: allPrices.length > 0 ? Math.round(allPrices.reduce((a,b) => a+b, 0) / allPrices.length) : 0,
      priceRange: allPrices.length > 0 ? { min: Math.min(...allPrices), max: Math.max(...allPrices) } : { min: 0, max: 0 },
    },
    products: cleanProducts,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ Saved to ${OUTPUT_FILE}`);

  // Copy to public/ and server/data/
  const publicFile = path.join(__dirname, "..", "public", "clean-products.json");
  const serverFile = path.join(__dirname, "..", "server", "data", "clean-products.json");
  fs.writeFileSync(publicFile, JSON.stringify(output, null, 2));
  fs.writeFileSync(serverFile, JSON.stringify(output, null, 2));
  console.log(`✓ Copied to public/ and server/data/`);

  // Print sample
  console.log(`\n📋 Sample Products:`);
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
    await uploadToSupabase(cleanProducts);
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  DONE: ${cleanProducts.length} clean products saved`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
