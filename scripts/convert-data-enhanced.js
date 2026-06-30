import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadTaxonomy, findTaxonomyMatch, getFrontendCategory } from './taxonomy-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════
//  ENHANCED CATEGORY DETECTION: Taxonomy Primary + Fallback
// ═══════════════════════════════════════════════════════════

// Laptop detection (must run FIRST)
const laptopIndicators = /\blaptop\b|\bnotebook\b|\bpc\s+portable\b|\bordinateur\s+portable\b/;
const laptopModel = /\b(?:g15|g16|g18|g14|g17|g513|g733)\b/;

function isLaptop(name) {
  const normalized = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // EXPLICIT laptop keywords (unambiguous - immediate return)
  const unambiguousLaptop = /\b(?:laptop|notebook|pc\s+portable|ordinateur\s+portable|macbook|surface|thinkpad|ideapad|pavilion|omen|victus|nitro|predator|alienware|xps|latitude|inspiron|chromebook|yoga|swift|aspire|stealth|blade|razer|zbook|precision|loq|probook|firefly|vivobook|zenbook|expertbook|defender|erazer|thin|ge75|ge76|ge77|katana|gf66|gf76|gp66|gp76|gl66|gl76|creator|flow|dash|cyborg|proart|xmg|titan|vector|raider|summit|prestige|modern|alpha|delta|bravo|pulse|sword|crosshair)\b/;
  if (unambiguousLaptop.test(normalized)) {
    return true;
  }
  
  // Laptop model numbers (unambiguous)
  if (laptopModel.test(normalized)) {
    return true;
  }
  
  // Laptop pattern detection: name contains multiple laptop components
  const hasCPU = /\b(?:core\s+i[3579]|i[3579]-\d{3,5}|i[3579]\b|r[3579]\b|ryzen\s*[3579]|ultra\s*[579]|athlon|pentium|celeron|xeon|threadripper)\b/.test(normalized);
  const hasGPU = /\b(?:rtx|gtx|rx|geforce|radeon)\b/.test(normalized);
  const hasRAM = /\b(?:ddr[345x]|ram)\b/.test(normalized) || /\b\d+\s*(?:gb|go)\s+(?:ddr|ram)\b/.test(normalized) || /\b(?:8|16|32|64|128)\s*(?:gb|go)\b/.test(normalized) || /\b\d+\s*(?:gb|go)?\s*(?:ddr[345x]|ram)\b/.test(normalized);
  const hasStorage = /\b(?:ssd|nvme|hdd)\b/.test(normalized) || /\b(?:128|256|512|1024|2048|4096|1|2|4)\s*(?:tb|to|gb|go)\b/.test(normalized);
  const hasScreen = /\b(?:\d+\s*[\"\']|\d+\.\d+\s*[\"\']|pouces?|inch|full\s*hd|2k|2\.5k|4k|qhd|fhd|oled|ips|144hz|165hz|240hz|360hz)\b/.test(normalized);
  
  // Ambiguous signals that suggest laptop but are not definitive alone
  const hasTUF = /\btuf\b/.test(normalized);
  const hasROG = /\b(?:rog\s+strix|rog\s+zephyrus|rog\s+flow)\b/.test(normalized);
  const hasAORUS = /\baorus\s+(?:16|17|15)\b/.test(normalized);
  const hasMSI = /\b(?:gf63|gf65|gf77|crosshair|pulse|sword|bravo|alpha|delta|modern|summit|prestige|cyborg|vector|raider|titan)\b/.test(normalized);
  const hasLegion = /\blegion\b/.test(normalized);
  
  // Count signals: CPU + GPU + RAM + storage + screen = 5
  // Plus ambiguous signals: TUF, ROG, AORUS, MSI, Legion
  const laptopSignals = [hasCPU, hasGPU, hasRAM, hasStorage, hasScreen, hasTUF, hasROG, hasAORUS, hasMSI, hasLegion].filter(Boolean).length;
  
  // For TUF/ROG/AORUS products: require 4+ signals including screen and CPU and RAM
  // For non-TUF products: require 4+ signals including screen and CPU and RAM and storage
  const hasAmbiguous = hasTUF || hasROG || hasAORUS || hasMSI || hasLegion;
  
  if (hasAmbiguous && laptopSignals >= 4 && hasScreen && hasCPU && hasRAM) {
    // Extra check: make sure it's not a standalone GPU card
    const hasGpuCard = /\bcarte\s+graphique\b|\bgraphics\s+card\b|\bvga\b|\bvideo\s+card\b/.test(normalized);
    if (hasGpuCard) return false;
    return true;
  }
  
  if (!hasAmbiguous && laptopSignals >= 4 && hasScreen && hasCPU && hasRAM && hasStorage) {
    return true;
  }
  
  return false;
}

// Fallback keyword-based detection (preserved from old version)
function detectCategoryFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();

  // LAPTOP check first (must not be matched as GPU)
  if (isLaptop(name)) return 'laptop';

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
  // Desktop
  if (/\bpc\s+fixe\b|\bpc\s+bureau\b|\bordinateur\s+de\s+bureau\b|\bdesktop\b/.test(lower)) return 'desktop';
  // Motherboard
  if (/\bcarte\s+mere\b|\bmotherboard\b|\bmainboard\b/.test(lower)) return 'pc-parts';
  
  return null;
}

// ═══════════════════════════════════════════════════════════
//  MAIN CONVERSION
// ═══════════════════════════════════════════════════════════

const CATEGORY_MAP = {
  'laptop': 'laptop',
  'desktop': 'desktop',
  'cpu': 'processors',
  'gpu': 'graphics-cards',
  'ram': 'memory',
  'storage': 'storage',
  'monitor': 'monitors',
  'motherboard': 'pc-parts',
  'psu': 'power-supplies',
  'case': 'cases',
  'cooling': 'cooling',
  'keyboard': 'keyboard',
  'mouse': 'mouse',
  'headset': 'headset',
  'pc_part': 'pc-parts',
  'pc-parts': 'pc-parts',
  'unknown': 'pc-parts',
};

function convertProduct(product, taxonomy, storeColors) {
  // Use taxonomy engine first
  const taxonomyMatch = findTaxonomyMatch(product.name, taxonomy);
  const taxonomyCategory = taxonomyMatch ? getFrontendCategory(taxonomyMatch.match.path) : null;
  
  // Fallback: use categorizer category or keyword detection
  const rawCategory = product.category || '';
  const fallbackCategory = detectCategoryFromName(product.name) || CATEGORY_MAP[rawCategory] || 'pc-parts';
  
  // Priority: taxonomy > laptop-detection > categorizer > keyword-fallback
  let category = taxonomyCategory || fallbackCategory;
  let categorySource = taxonomyCategory ? 'taxonomy' : (CATEGORY_MAP[rawCategory] ? 'categorizer' : 'keyword-fallback');
  
  // Laptop detection override (must run after taxonomy because converter has more context)
  if (isLaptop(product.name)) {
    category = 'laptop';
    categorySource = 'laptop-detection';
  } else if (category === 'laptop' && !isLaptop(product.name)) {
    // Categorizer falsely classified as laptop - reset to fallback
    category = fallbackCategory === 'laptop' ? 'pc-parts' : fallbackCategory;
    categorySource = 'categorizer-corrected';
  }
  
  // Normalize brand
  const brand = product.brand || 'Unknown';
  
  // Calculate prices at product level
  const listings = product.listings || [];
  const currentPrices = listings.map(p => p.price).filter(p => p > 0);
  const currentPrice = currentPrices.length > 0 ? Math.min(...currentPrices) : 0;
  const originalPrice = product.worstPrice || product.averagePrice || 0;
  const savings = originalPrice > currentPrice ? Math.round((1 - currentPrice / originalPrice) * 100) : 0;
  
  // Get store info
  const store = listings?.[0]?.source || product.store || 'Unknown';
  const store_color = product.store_color || '#6366f1';
  
  // Image fallback
  const image = product.imageUrl || product.image || '';
  
  // Specs as array (frontend expects string[])
  const specs = product.specs ? Object.entries(product.specs).map(([k, v]) => `${k}: ${v}`) : [];
  
  // Transform listings to RetailerPrice format (frontend expects these fields)
  const prices = listings.map(l => {
    const lCurrent = l.price || 0;
    const lOriginal = l.old_price || 0;
    const lSavings = lOriginal > lCurrent ? Math.round((1 - lCurrent / lOriginal) * 100) : 0;
    return {
      retailer: l.source || 'Unknown',
      color: storeColors[l.source] || '#6366f1',
      current: lCurrent,
      original: lOriginal,
      shipping: l.shipping || '',
      stock: l.stock || 'متوفر',
      savings: lSavings,
      url: l.url || '',
    };
  });
  
  return {
    id: product.id,
    slug: product.canonicalName || product.name || '',
    name: product.name,
    brand: brand,
    category: category,
    image: image,
    rating: 0,
    reviewCount: product.listingCount || 0,
    description: '',
    specs: specs,
    prices: prices,
    current_price: currentPrice,
    original_price: originalPrice,
    store: store,
    store_color: store_color,
    savings: savings,
  };
}

function main() {
  // Load data
  const rawData = JSON.parse(readFileSync(join(__dirname, '../public/clean-products.json'), 'utf8'));
  const products = rawData.products || [];
  
  // Load taxonomy
  const taxonomy = loadTaxonomy();
  
  // First pass: collect all stores to build storeColors map
  const storeColors = {};
  for (const p of products) {
    const listings = p.listings || [];
    for (const l of listings) {
      const source = l.source || 'Unknown';
      if (!storeColors[source]) {
        storeColors[source] = p.store_color || '#6366f1';
      }
    }
  }
  
  // Second pass: convert all products with storeColors
  const converted = products.map(p => convertProduct(p, taxonomy, storeColors));
  
  // Collect store colors (final pass to ensure all stores are captured)
  for (const p of converted) {
    if (p.store && !storeColors[p.store]) {
      storeColors[p.store] = p.store_color;
    }
  }
  
  // Collect categories as array with slug/name/count (frontend expects this format)
  const categories = [];
  for (const p of converted) {
    const existing = categories.find(c => c.slug === p.category);
    if (existing) {
      existing.count++;
    } else {
      categories.push({ slug: p.category, name: p.category, count: 1 });
    }
  }
  
  // Category source stats
  const categorySources = {};
  for (const p of converted) {
    const source = p.categorySource || 'default';
    categorySources[source] = (categorySources[source] || 0) + 1;
  }
  
  console.log('Category sources:', categorySources);
  
  // Write output
  const outputDir = join(__dirname, '../public/data');
  mkdirSync(outputDir, { recursive: true });
  
  writeFileSync(join(outputDir, 'products.json'), JSON.stringify({
    storeColors,
    categories,
    products: converted,
    taxonomyVersion: '1.0',
    taxonomyBuildTime: new Date().toISOString(),
  }, null, 2));
  
  console.log(`Converted: ${converted.length} products, ${categories.length} categories, ${Object.keys(storeColors).length} stores`);
}

main();
