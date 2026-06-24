/**
 * Deal Finder DZ — PCParts Engine v2 Integration
 * Uses the comprehensive pcparts-engine-v2.js for:
 * - Smart category detection (weighted scoring)
 * - Detailed spec extraction (CPU cores, GPU VRAM, RAM speed, etc.)
 * - Model-based deduplication (not just fuzzy title matching)
 * - Cross-retailer comparison
 * - Brand normalization from comprehensive database
 */

const fs = require("fs");
const path = require("path");

// Load the engine (uses global assignment for Node.js compatibility)
require("./pcparts-engine-v2.js");
const PCPartsEngine = global.PCPartsEngine;

if (!PCPartsEngine) {
  console.error("Failed to load PCParts Engine v2");
  process.exit(1);
}

// ─── Configuration ───
const INPUT_FILE = process.argv[2] || path.join(__dirname, "scrape-results.json");
const OUTPUT_FILE = process.argv[3] || path.join(__dirname, "clean-products-v2.json");
const MATCH_THRESHOLD = 35; // Minimum match score to group as same product

// ─── Convert our scraped data to engine format ───
function convertToEngineFormat(scrapedProducts) {
  return scrapedProducts.map(p => ({
    name: p.title || p.name || "",
    price: p.price ? `${p.price} DA` : null,
    old_price: null,
    url: p.url || "",
    image: p.imageUrl || p.image || "",
    availability: p.condition || "New",
    site: p.source || "Unknown",
    sku: null,
    product_id: null,
    scrapedAt: new Date().toISOString(),
  }));
}

// ─── Convert engine output to our CleanProduct format ───
function convertToCleanFormat(engineProduct, allListings) {
  const listings = allListings
    .filter(l => l.url && l.url.length > 5)
    .map(l => ({
      source: l.retailer || l.site || "Unknown",
      price: l.price || 0,
      condition: l.condition || "new",
      location: l.retailer?.includes("Alger") ? "Alger" : "Algeria",
      url: l.url,
      imageUrl: l.image || null,
    }));

  // Remove duplicate URLs
  const seenUrls = new Set();
  const uniqueListings = listings.filter(l => {
    if (seenUrls.has(l.url)) return false;
    seenUrls.add(l.url);
    return true;
  });

  const prices = uniqueListings.map(l => l.price).filter(p => p > 0);

  return {
    id: engineProduct.id || `prd-${Date.now().toString(36)}`,
    canonicalName: engineProduct.name,
    brand: engineProduct.brand === "Unknown" ? null : engineProduct.brand,
    category: engineProduct.category === "unknown" ? "pc_part" : engineProduct.category,
    specs: engineProduct.specs || {},
    imageUrl: engineProduct.image || null,
    bestPrice: prices.length > 0 ? Math.min(...prices) : 0,
    worstPrice: prices.length > 0 ? Math.max(...prices) : 0,
    averagePrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    listingCount: uniqueListings.length,
    storeCount: new Set(uniqueListings.map(l => l.source)).size,
    listings: uniqueListings,
  };
}

// ─── Main Deduplication using Engine's Model Matching ───
function deduplicateWithEngine(processedProducts) {
  console.log(`\n🧹 Deduplicating ${processedProducts.length} products using PCParts Engine v2...\n`);

  // Group by model identifier (much smarter than fuzzy title matching)
  const modelGroups = {};
  const unmatched = [];

  for (const product of processedProducts) {
    const ids = PCPartsEngine.extractModelIdentifier(product.name, product.category);
    
    if (ids.length > 0) {
      // Use first model identifier as group key
      const key = `${product.category}::${ids[0]}`;
      if (!modelGroups[key]) modelGroups[key] = [];
      modelGroups[key].push(product);
    } else {
      // No model identifier found, use normalized name
      unmatched.push(product);
    }
  }

  console.log(`  ✓ ${Object.keys(modelGroups).length} model-based groups`);
  console.log(`  ✓ ${unmatched.length} products without model identifiers`);

  // Try to match unmatched products against existing groups
  const finalGroups = { ...modelGroups };
  
  for (const product of unmatched) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [key, group] of Object.entries(modelGroups)) {
      // Check if category matches
      const groupCategory = key.split("::")[0];
      if (product.category !== groupCategory) continue;
      
      // Calculate match score against first item in group
      const score = PCPartsEngine.calculateMatchScore(product, group[0]);
      if (score > bestScore && score >= MATCH_THRESHOLD) {
        bestScore = score;
        bestMatch = key;
      }
    }
    
    if (bestMatch) {
      finalGroups[bestMatch].push(product);
    } else {
      // Create new group for unmatched
      const key = `unmatched::${product.id}`;
      finalGroups[key] = [product];
    }
  }

  console.log(`  ✓ ${Object.keys(finalGroups).length} final groups\n`);

  return finalGroups;
}

// ─── Build Clean Products from Groups ───
function buildCleanProducts(groups) {
  const cleanProducts = [];
  
  for (const [key, group] of Object.entries(groups)) {
    if (group.length === 0) continue;
    
    // Pick the best representative (cleanest name with most info)
    const representative = group.reduce((best, current) => {
      const bestScore = (best.name?.length || 0) + (Object.keys(best.specs || {}).length * 10);
      const currentScore = (current.name?.length || 0) + (Object.keys(current.specs || {}).length * 10);
      return currentScore > bestScore ? current : best;
    });

    const clean = convertToCleanFormat(representative, group);
    if (clean.listingCount > 0 && clean.bestPrice > 1000) {
      cleanProducts.push(clean);
    }
  }

  // Sort by popularity (most listings first)
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
  console.log(`  DEAL FINDER DZ — PCParts Engine v2 Integration`);
  console.log(`  Input:  ${INPUT_FILE}`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  // Load scraped data
  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  } catch (e) {
    console.error(`Failed to load ${INPUT_FILE}: ${e.message}`);
    process.exit(1);
  }

  const products = rawData.products || rawData;
  console.log(`Loaded ${products.length} raw products\n`);

  // Step 1: Convert to engine format and process
  console.log(`Step 1: Processing through PCParts Engine v2...`);
  const engineInput = convertToEngineFormat(products);
  const processed = PCPartsEngine.processBatch(engineInput);
  console.log(`  ✓ Processed ${processed.length} products`);
  
  // Show category distribution
  const categories = {};
  for (const p of processed) {
    categories[p.category] = (categories[p.category] || 0) + 1;
  }
  console.log(`  Categories:`, Object.entries(categories).map(([k, v]) => `${k}=${v}`).join(", "));

  // Step 2: Deduplicate using model identifiers
  console.log(`\nStep 2: Model-based deduplication...`);
  const groups = deduplicateWithEngine(processed);

  // Step 3: Build clean products
  console.log(`Step 3: Building clean product catalog...`);
  const cleanProducts = buildCleanProducts(groups);

  // Step 4: Get stats
  const stats = PCPartsEngine.getStats(processed);
  
  console.log(`\n📊 Results:`);
  console.log(`  Raw products: ${products.length}`);
  console.log(`  Engine processed: ${processed.length}`);
  console.log(`  Clean products: ${cleanProducts.length}`);
  console.log(`  Duplicates removed: ${processed.length - cleanProducts.length}`);
  console.log(`  Reduction: ${((processed.length - cleanProducts.length) / processed.length * 100).toFixed(1)}%`);
  console.log(`  Average price: ${stats.averagePrice.toLocaleString()} DZD`);
  console.log(`  Price range: ${stats.priceRange.min.toLocaleString()} - ${stats.priceRange.max.toLocaleString()} DZD`);
  console.log(`  On sale: ${stats.saleCount}`);
  console.log(`\n  Category breakdown:`);
  stats.categories.forEach(c => {
    console.log(`    ${c.name}: ${c.count} (${c.percentage}%)`);
  });

  // Save output
  const output = {
    timestamp: new Date().toISOString(),
    total: cleanProducts.length,
    stats: {
      originalCount: products.length,
      engineProcessed: processed.length,
      cleanCount: cleanProducts.length,
      duplicateCount: processed.length - cleanProducts.length,
      reductionRate: `${((processed.length - cleanProducts.length) / processed.length * 100).toFixed(1)}%`,
      averagePrice: stats.averagePrice,
      priceRange: stats.priceRange,
      saleCount: stats.saleCount,
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
