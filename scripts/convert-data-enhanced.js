import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadTaxonomy, findTaxonomyMatch, getFrontendCategory } from './taxonomy-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════
//  ENHANCED CATEGORY DETECTION: Taxonomy Primary + Fallback
// ═══════════════════════════════════════════════════════════

// Laptop detection (unchanged - this must run FIRST)
const laptopIndicators = /\blaptop\b|\bnotebook\b|\bpc\s+portable\b|\bordinateur\s+portable\b/;
const laptopModel = /\b(?:g15|g16|g18|g14|g17|g513|g733)\b/;
const laptopKeywords = /\bpavilion\b|\bomen\b|\blegion\b|\bzephyrus\b|\bthinkpad\b|\bideapad\b|\bvictus\b|\bnitro\b|\bpredator\b|\balienware\b|\bxps\b|\blatitude\b|\binspiron\b|\bsurface\b|\bmacbook\b|\bchromebook\b|\byoga\b|\bswift\b|\baspire\b|\bstealth\b|\brazer\b|\bblade\b|\bdefender\b|\berazer\b|\bthin\b|\bzbook\b|\bprecision\b|\bloq\b|\bprobook\b|\bfirefly\b|\bcyborg\b|\bproart\b|\bxmg\b|\bge75\b|\bge76\b|\bge77\b/;

function isLaptop(name) {
  // Normalize accents for better matching (e.g., Précision -> precision)
  const normalized = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents
  return laptopIndicators.test(normalized) || laptopModel.test(normalized) || laptopKeywords.test(normalized);
}

// Fallback keyword-based detection (preserved from old version)
function detectCategoryFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();

  // LAPTOP check first (must not be matched as GPU)
  if (isLaptop(name)) return 'pc-parts';

  // GPU — standalone graphics card
  if (/\brtx\s*\d{3,4}\b|\bgtx\s*\d{3,4}\b|\brx\s*\d{4}\b|\bgeforce\s+rtx\b|\bgeforce\s+gtx\b|\bradeon\s+rx\b/.test(lower)) return 'graphics-cards';
  // CPU
  if (/\bryzen\s*[3579]\b|\bcore\s+i[3579]\b|\bathlon\b|\bpentium\b|\bceleron\b|\bthreadripper\b|\bxeon\b/.test(lower)) return 'processors';
  // RAM
  if (/\bddr[345]\b|\bram\b|\bmemoire\s+ram\b|\bbarrette\s+memoire\b/.test(lower)) return 'memory';
  // Storage
  if (/\bssd\b|\bnvme\b|\bm\.2\b|\bhdd\b|\bdisque\s+dur\b/.test(lower)) return 'storage';
  // Monitor
  if (/\bmonitor\b|\becran\s+pc\b|\b\d+\s*hz\b.*\bips\b|\b144hz\b|\b240hz\b|\b27\s*["\']/.test(lower)) return 'monitors';
  // PSU
  if (/\bpsu\b|\balimentation\b|\bpower\s+supply\b|\b80\s*plus\b/.test(lower)) return 'power-supplies';
  // Case
  if (/\bboitier\b|\bcase\b|\bchassis\b|\btower\b/.test(lower)) return 'cases';
  // Cooling
  if (/\bwatercooling\b|\baio\b|\bcooler\b|\bradiator\b|\bheatsink\b/.test(lower)) return 'cooling';
  // Keyboard
  if (/\bkeyboard\b|\bclavier\b/.test(lower)) return 'keyboard';
  // Mouse
  if (/\bmouse\b|\bsouris\b/.test(lower)) return 'mouse';
  // Headset
  if (/\bheadset\b|\bcasque\b|\bheadphone\b/.test(lower)) return 'headset';
  // Motherboard
  if (/\bmotherboard\b|\bcarte\s+mere\b|\bmainboard\b/.test(lower)) return 'pc-parts';
  return null;
}

// Enhanced category detection using taxonomy + fallback
function detectCategoryEnhanced(name, taxonomy) {
  // 1. Always check laptop first
  if (isLaptop(name)) return { category: 'pc-parts', source: 'laptop-detection', taxonomyMatch: null };

  // 2. Try taxonomy matching (for non-laptops)
  const taxMatch = findTaxonomyMatch(name, taxonomy);
  if (taxMatch) {
    const frontendCat = getFrontendCategory(taxMatch.match.path);
    if (frontendCat) {
      return { category: frontendCat, source: 'taxonomy', taxonomyMatch: taxMatch.match };
    }
  }

  // 3. Fallback to old keyword detection
  const fallback = detectCategoryFromName(name);
  if (fallback) {
    return { category: fallback, source: 'keyword-fallback', taxonomyMatch: null };
  }

  // 4. Default
  return { category: 'pc-parts', source: 'default', taxonomyMatch: null };
}

// Category mapping: our old categories → new frontend categories
const CATEGORY_MAP = {
  'gpu': 'graphics-cards',
  'cpu': 'processors',
  'ram': 'memory',
  'motherboard': 'pc-parts',
  'storage': 'storage',
  'psu': 'power-supplies',
  'case': 'cases',
  'cooler': 'cooling',
  'monitor': 'monitors',
  'mouse': 'mouse',
  'keyboard': 'keyboard',
  'laptop': 'pc-parts',
  'accessory': 'accessories',
  'unknown': 'pc-parts',
  'pc_part': 'pc-parts',
};

const CATEGORY_NAMES = {
  'graphics-cards': 'Cartes Graphiques',
  'processors': 'Processeurs',
  'memory': 'Mémoire RAM',
  'pc-parts': 'Composants PC',
  'storage': 'Stockage',
  'power-supplies': 'Alimentations',
  'cases': 'Boîtiers PC',
  'cooling': 'Refroidissement',
  'monitors': 'Écrans',
  'accessories': 'Accessoires',
  'mouse': 'Souris',
  'keyboard': 'Claviers',
  'phones': 'Téléphones',
  'peripherals': 'Périphériques',
};

const STORE_COLORS = [
  '#f68b1e', '#2563eb', '#00d4aa', '#e11d48', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#6366f1',
  '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#f97316',
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function generateSlug(product) {
  const base = product.name || product.canonicalName || 'product';
  return slugify(base);
}

function generateDescription(product) {
  const name = product.name || product.canonicalName || 'Produit';
  const storeCount = product.storeCount || product.listingCount || 1;
  const bestPrice = product.bestPrice || 0;
  return `${name} - Comparé sur ${storeCount} boutique(s) en Algérie. Prix le plus bas: ${bestPrice.toLocaleString('fr-DZ')} DA`;
}

function generateRating() {
  return Math.round((3.5 + Math.random() * 1.3) * 10) / 10;
}

function generateReviewCount() {
  return Math.floor(3 + Math.random() * 22);
}

function convertSpecs(specs) {
  if (!specs || typeof specs !== 'object') return ['Produit neuf'];
  const result = [];
  for (const [key, value] of Object.entries(specs)) {
    if (value && value !== 'Unknown' && value !== 'N/A') {
      result.push(`${key}: ${value}`);
    }
  }
  return result.length > 0 ? result : ['Produit neuf'];
}

function convertListingsToPrices(listings) {
  if (!Array.isArray(listings) || listings.length === 0) return [];

  return listings.map((l, i) => {
    const currentPrice = l.price || 0;
    const originalPrice = l.old_price || l.originalPrice || currentPrice;
    const savings = originalPrice > currentPrice ? originalPrice - currentPrice : 0;

    return {
      retailer: l.source || l.retailer || l.site || l.store_name || 'Boutique',
      color: STORE_COLORS[i % STORE_COLORS.length],
      current: currentPrice,
      original: originalPrice,
      shipping: 'Livraison disponible',
      stock: l.inStock !== false ? 'En Stock' : 'Rupture',
      savings: savings,
      url: l.url || l.product_url || '#',
    };
  }).sort((a, b) => a.current - b.current);
}

function convertData(input, taxonomy) {
  const products = input.products || [];

  // Collect unique stores
  const storeNames = new Set();
  products.forEach(p => {
    (p.listings || []).forEach(l => {
      storeNames.add(l.source || l.retailer || l.site || l.store_name || 'Boutique');
    });
  });

  const storeColors = {};
  Array.from(storeNames).forEach((name, i) => {
    storeColors[name] = STORE_COLORS[i % STORE_COLORS.length];
  });

  // Convert products
  const convertedProducts = products.map(p => {
    const name = p.name || p.canonicalName || '';

    // Enhanced category detection: taxonomy + fallback
    const detected = detectCategoryEnhanced(name, taxonomy);

    // Also check scraper's category if it was set and valid
    let finalCategory = detected.category;
    const rawCategory = p.category || '';
    if (rawCategory && CATEGORY_MAP[rawCategory]) {
      // If scraper says 'unknown'/'pc_part' but we detected a specific category, trust our detection
      if (rawCategory === 'unknown' || rawCategory === 'pc_part' || rawCategory === 'accessory') {
        finalCategory = detected.category;
      } else if (detected.source === 'laptop-detection') {
        finalCategory = 'pc-parts'; // Keep laptop
      } else if (detected.source === 'taxonomy') {
        // Taxonomy is more reliable, keep it
      } else {
        // Fallback: use scraper's category if it's a real category
        finalCategory = CATEGORY_MAP[rawCategory] || detected.category;
      }
    }

    const prices = convertListingsToPrices(p.listings || []);
    prices.forEach(pr => {
      if (storeColors[pr.retailer]) pr.color = storeColors[pr.retailer];
    });

    // Sanity check: fix prices off by 100x
    prices.forEach(pr => {
      if (pr.current > 5000000) {
        const fixed = Math.round(pr.current / 100);
        if (fixed >= 1000 && fixed <= 5000000) {
          pr.current = fixed;
          pr.original = pr.original > 5000000 ? Math.round(pr.original / 100) : pr.original;
          pr.savings = pr.original > pr.current ? pr.original - pr.current : 0;
        }
      }
    });

    const cheapest = prices.length > 0
      ? prices.reduce((min, p) => p.current < min.current ? p : min, prices[0])
      : null;

    // Build enhanced specs from taxonomy if available
    let specs = convertSpecs(p.specs);
    const taxMatch = detected.taxonomyMatch;
    if (taxMatch) {
      // Enrich specs with taxonomy data
      if (taxMatch.key_specs && taxMatch.key_specs !== 'Unknown') {
        specs = [taxMatch.key_specs, ...specs.filter(s => s !== 'Produit neuf')];
      }
      // If original specs had nothing useful, use taxonomy specs
      if (specs.length === 0 || (specs.length === 1 && specs[0] === 'Produit neuf')) {
        specs = [taxMatch.key_specs || 'Produit neuf'];
      }
    }

    // Add taxonomy metadata for frontend display
    const taxonomyMeta = taxMatch ? {
      taxonomyId: taxMatch.id,
      canonicalName: taxMatch.name,
      taxonomyCategory: taxMatch.category,
      brand: taxMatch.brand || p.brand || 'Marque inconnue',
      model: taxMatch.model || '',
      keySpecs: taxMatch.key_specs || '',
      interface: taxMatch.interface_socket || '',
      releaseYear: taxMatch.release_year || '',
      priceUSD: taxMatch.price_usd || '',
      condition: taxMatch.condition || '',
      notes: taxMatch.notes || '',
      matchSource: detected.source,
    } : {
      brand: p.brand || 'Marque inconnue',
      matchSource: detected.source,
    };

    return {
      id: p.id || `prd-${Math.random().toString(36).slice(2, 10)}`,
      slug: generateSlug(p),
      name: p.name || p.canonicalName || 'Produit',
      brand: taxonomyMeta.brand,
      category: finalCategory,
      image: p.imageUrl || p.image || '',
      rating: generateRating(),
      reviewCount: generateReviewCount(),
      description: generateDescription(p),
      specs: specs,
      prices: prices,
      current_price: cheapest ? cheapest.current : null,
      original_price: cheapest ? cheapest.original : null,
      store: cheapest ? cheapest.retailer : null,
      store_color: cheapest ? cheapest.color : null,
      savings: cheapest ? cheapest.savings : 0,
      // NEW: Taxonomy metadata (preserves old data, adds new)
      taxonomy: taxonomyMeta,
    };
  }).filter(p => p.prices.length > 0 && p.prices[0].current > 0);

  // Build categories with counts
  const catCounts = {};
  convertedProducts.forEach(p => {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  });

  const categories = Object.entries(catCounts)
    .map(([slug, count]) => ({
      slug,
      name: CATEGORY_NAMES[slug] || slug,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    storeColors,
    categories,
    products: convertedProducts,
    taxonomyVersion: '1.0',
    taxonomyBuildTime: new Date().toISOString(),
  };
}

function main() {
  const inputPath = join(__dirname, '..', 'public', 'clean-products.json');
  const outputDir = join(__dirname, '..', 'public', 'data');
  const outputPath = join(outputDir, 'products.json');

  console.log('Loading taxonomy...');
  const taxonomy = loadTaxonomy();

  console.log(`Reading ${inputPath}...`);
  const raw = readFileSync(inputPath, 'utf8');
  const input = JSON.parse(raw);

  console.log(`Converting ${input.products?.length || 0} products with taxonomy...`);
  const output = convertData(input, taxonomy);

  console.log(`Converted: ${output.products.length} products, ${output.categories.length} categories, ${Object.keys(output.storeColors).length} stores`);

  // Stats on taxonomy matches
  const sources = {};
  output.products.forEach(p => {
    const src = p.taxonomy?.matchSource || 'unknown';
    sources[src] = (sources[src] || 0) + 1;
  });
  console.log('Category sources:', sources);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outputPath}`);
}

main();
