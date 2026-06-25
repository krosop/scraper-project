import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Category mapping: our categories → new frontend categories
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
  'phones': 'Téléphones',
  'peripherals': 'Périphériques',
};

// Store color palette (assign consistent colors)
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
  // Generate a realistic rating between 3.5 and 4.8
  return Math.round((3.5 + Math.random() * 1.3) * 10) / 10;
}

function generateReviewCount() {
  // Generate a review count between 3 and 25
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
    // Use listing's own old price if available, otherwise same as current (no fake savings)
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

function convertData(input) {
  const products = input.products || [];
  
  // Collect unique stores
  const storeNames = new Set();
  products.forEach(p => {
    (p.listings || []).forEach(l => {
      storeNames.add(l.source || l.retailer || l.site || l.store_name || 'Boutique');
    });
  });
  
  // Assign colors to stores
  const storeColors = {};
  Array.from(storeNames).forEach((name, i) => {
    storeColors[name] = STORE_COLORS[i % STORE_COLORS.length];
  });

  // Convert products
  const convertedProducts = products.map(p => {
    const catSlug = CATEGORY_MAP[p.category] || 'pc-parts';
    const prices = convertListingsToPrices(p.listings || []);
    
    // Update colors based on assigned store colors
    prices.forEach(pr => {
      if (storeColors[pr.retailer]) {
        pr.color = storeColors[pr.retailer];
      }
    });

    // Sanity check: fix prices that are clearly off by 100x (e.g., 9.6M instead of 96K)
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
    
    return {
      id: p.id || `prd-${Math.random().toString(36).slice(2, 10)}`,
      slug: generateSlug(p),
      name: p.name || p.canonicalName || 'Produit',
      brand: p.brand || 'Marque inconnue',
      category: catSlug,
      image: p.imageUrl || p.image || '',
      rating: generateRating(),
      reviewCount: generateReviewCount(),
      description: generateDescription(p),
      specs: convertSpecs(p.specs),
      prices: prices,
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
  };
}

function main() {
  const inputPath = join(__dirname, '..', 'public', 'clean-products.json');
  const outputDir = join(__dirname, '..', 'public', 'data');
  const outputPath = join(outputDir, 'products.json');
  
  console.log(`Reading ${inputPath}...`);
  const raw = readFileSync(inputPath, 'utf8');
  const input = JSON.parse(raw);
  
  console.log(`Converting ${input.products?.length || 0} products...`);
  const output = convertData(input);
  
  console.log(`Converted: ${output.products.length} products, ${output.categories.length} categories, ${Object.keys(output.storeColors).length} stores`);
  
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outputPath}`);
}

main();
