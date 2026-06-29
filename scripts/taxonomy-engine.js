// ═══════════════════════════════════════════════════════════
//  PC PARTS TAXONOMY ENGINE — Parses CSV taxonomy tree + matches scraped products
//  Maps noisy scraped names to canonical taxonomy entries
// ═══════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────────────────────
//  1. PARSE CSV INTO TAXONOMY TREE + FLAT LOOKUP
// ──────────────────────────────────────────────────────────

function parseCSV(csvPath) {
  const text = readFileSync(csvPath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  const rows = [];

  // Header: ID,Parent_ID,Node_Type,Name,Category,Brand,Model,Key_Specs,Interface_Socket,Release_Year,Price_USD,Condition,Notes
  // Simple split - note that some names contain commas inside quotes
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle quoted fields that contain commas
    const cols = [];
    let inQuote = false;
    let current = '';
    for (const char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    // Remove quotes from values
    for (let j = 0; j < cols.length; j++) {
      cols[j] = cols[j].replace(/^"|"$/g, '').trim();
    }

    if (cols.length >= 5) {
      rows.push({
        id: parseInt(cols[0]) || 0,
        parent_id: parseInt(cols[1]) || 0,
        node_type: cols[2] || '',
        name: cols[3] || '',
        category: cols[4] || '',
        brand: cols[5] || '',
        model: cols[6] || '',
        key_specs: cols[7] || '',
        interface_socket: cols[8] || '',
        release_year: cols[9] || '',
        price_usd: cols[10] || '',
        condition: cols[11] || '',
        notes: cols[12] || '',
      });
    }
  }
  return rows;
}

// Build tree + flat lookup
function buildTaxonomy(rows) {
  const idMap = new Map();
  const tree = [];

  for (const row of rows) {
    idMap.set(row.id, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = idMap.get(row.id);
    if (row.parent_id === 0) {
      tree.push(node);
    } else {
      const parent = idMap.get(row.parent_id);
      if (parent) parent.children.push(node);
    }
  }

  // Build flat lookup: every product node with path info
  const productLookup = [];
  const allProducts = [];

  function traverse(node, path) {
    const newPath = [...path, { type: node.node_type, name: node.name, category: node.category }];
    if (node.node_type === 'Product') {
      productLookup.push({
        ...node,
        path: newPath,
        // Build canonical searchable name
        canonicalName: node.model || node.name,
        // Build search keys for matching
        searchKeys: buildSearchKeys(node, newPath),
      });
      allProducts.push(node);
    }
    for (const child of node.children) {
      traverse(child, newPath);
    }
  }

  for (const root of tree) {
    traverse(root, []);
  }

  return { tree, productLookup, allProducts, idMap };
}

function buildSearchKeys(node, path) {
  const keys = [];
  const lower = (node.name + ' ' + node.model + ' ' + node.brand).toLowerCase();

  // Add the product name itself
  keys.push(node.name.toLowerCase());
  if (node.model) keys.push(node.model.toLowerCase());

  // Add brand + model combos
  if (node.brand) {
    keys.push((node.brand + ' ' + node.name).toLowerCase());
  }

  // Add variant forms (e.g., "RTX 5090" → "rtx 5090", "rtx5090", "rtx 5090 32gb")
  const normalized = node.name.toLowerCase().replace(/[^\w\d\s]/g, ' ').replace(/\s+/g, ' ').trim();
  keys.push(normalized);

  // Also push without brand (e.g., "RTX 5090" without "NVIDIA")
  const withoutBrand = normalized.replace(new RegExp('\\b' + (node.brand || '').toLowerCase() + '\\b', 'g'), '').replace(/\s+/g, ' ').trim();
  if (withoutBrand && withoutBrand !== normalized) keys.push(withoutBrand);

  return [...new Set(keys.filter(k => k.length > 2))];
}

// ──────────────────────────────────────────────────────────
//  2. MATCHING ENGINE
// ──────────────────────────────────────────────────────────

// Normalize a scraped product name for matching
function normalizeScrapedName(name) {
  let n = name.toLowerCase();
  // Remove common noise words
  n = n.replace(/\b(used|etat|occasion|neuf|new|tray|bulk|boite|box|in stock|disponible|livraison|promo|soldes|offre|special|limited|edition|tactile|inclinable|reconditionne|reconditionné|oem)\b/g, ' ');
  // Clean up punctuation
  n = n.replace(/[^\w\d\s\-]/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

// Extract model identifiers from a scraped name (e.g., "RTX 5080", "Core i5-14600K")
function extractModelIdentifiers(name) {
  const lower = name.toLowerCase();
  const identifiers = [];

  // GPU patterns
  const gpuMatch = lower.match(/\b(?:rtx|gtx|rx|arc)\s*[\d]{3,4}(?:\s*(?:ti|super|xt|xtx))?\b/);
  if (gpuMatch) identifiers.push(gpuMatch[0].replace(/\s+/g, ' ').trim());

  // CPU patterns
  const cpuMatch = lower.match(/\b(?:core\s+(?:i[3579]|ultra)\s*[-\s]?[\d]{3,5}[a-z]*|ryzen\s*[3579]\s*[\d]{4}[a-z]*|athlon|pentium|celeron|xeon|threadripper)\b/i);
  if (cpuMatch) identifiers.push(cpuMatch[0].replace(/\s+/g, ' ').trim().toLowerCase());

  // RAM patterns
  const ramMatch = lower.match(/\b(?:ddr[345]\s*(?:\d+\s*gb)?(?:\s*\d{4,5}\s*mhz)?|(?:\d+\s*gb)?\s*ddr[345])\b/i);
  if (ramMatch) identifiers.push(ramMatch[0].replace(/\s+/g, ' ').trim().toLowerCase());

  // SSD/HDD patterns
  const storageMatch = lower.match(/\b(?:\d+\s*(?:tb|gb|go|to)\s*(?:ssd|nvme|hdd)|(?:samsung|wd|seagate|crucial|kingston)\s*(?:\d+)?\s*(?:\w+)?\s*(?:ssd|nvme))\b/i);
  if (storageMatch) identifiers.push(storageMatch[0].replace(/\s+/g, ' ').trim().toLowerCase());

  return identifiers;
}

// Main match function: find best taxonomy match for a scraped product
function findTaxonomyMatch(productName, taxonomy) {
  const normalized = normalizeScrapedName(productName);
  const lowerProduct = normalized;

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of taxonomy.productLookup) {
    let score = 0;

    // Direct substring match of canonical name
    const canonicalLower = entry.canonicalName.toLowerCase();
    if (lowerProduct.includes(canonicalLower)) {
      score += 100; // Strong match
    }

    // Model identifier match (e.g., "RTX 5080" in product name matches "RTX 5080" in taxonomy)
    const model = entry.model.toLowerCase();
    if (model && lowerProduct.includes(model)) {
      score += 80;
    }

    // Check search keys
    for (const key of entry.searchKeys) {
      if (lowerProduct.includes(key)) {
        score += 60;
        break;
      }
    }

    // Brand match
    const brand = entry.brand.toLowerCase();
    if (brand && lowerProduct.includes(brand)) {
      score += 20;
    }

    // Category keyword match (e.g., "RTX" in GPU, "DDR" in RAM)
    const catPath = entry.path.map(p => p.name.toLowerCase()).join(' ');
    if (catPath.includes('gpu') && /\b(?:rtx|gtx|rx|geforce|radeon)\b/.test(lowerProduct)) {
      score += 30;
    }
    if (catPath.includes('cpu') && /\b(?:core|ryzen|athlon|pentium|xeon|threadripper)\b/.test(lowerProduct)) {
      score += 30;
    }
    if (catPath.includes('ram') && /\bddr[345]\b/.test(lowerProduct)) {
      score += 30;
    }
    if (catPath.includes('ssd') && /\b(?:ssd|nvme)\b/.test(lowerProduct)) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  // Require minimum confidence
  if (bestScore >= 40) {
    return { match: bestMatch, score: bestScore };
  }
  return null;
}

// ──────────────────────────────────────────────────────────
//  3. BUILD CATEGORY MAP FOR TAXONOMY → FRONTEND
// ──────────────────────────────────────────────────────────

const TAXONOMY_TO_FRONTEND = {
  'CPU': 'processors',
  'GPU': 'graphics-cards',
  'RAM': 'memory',
  'Motherboard': 'pc-parts',
  'SSD': 'storage',
  'HDD': 'storage',
  'Power Supply': 'power-supplies',
  'CPU Cooler (Air)': 'cooling',
  'CPU Cooler (AIO)': 'cooling',
  'Case': 'cases',
  'Monitor': 'monitors',
  'Keyboard': 'keyboard',
  'Mouse': 'mouse',
  'Headset': 'headset',
  'Case Fan': 'cooling',
  'Thermal Paste': 'cooling',
  'Networking': 'pc-parts',
  'Sound Card': 'pc-parts',
  'Capture Card': 'pc-parts',
  'UPS': 'power-supplies',
  // SubCategory mappings
  'CPU Cooler': 'cooling',
};

function getFrontendCategory(taxonomyPath) {
  // Walk up the path to find a matching category
  for (let i = taxonomyPath.length - 1; i >= 0; i--) {
    const name = taxonomyPath[i].name;
    const category = taxonomyPath[i].category;

    if (TAXONOMY_TO_FRONTEND[name]) return TAXONOMY_TO_FRONTEND[name];
    if (TAXONOMY_TO_FRONTEND[category]) return TAXONOMY_TO_FRONTEND[category];
  }
  return null;
}

// ──────────────────────────────────────────────────────────
//  4. ENHANCED CONVERTER WITH TAXONOMY
// ──────────────────────────────────────────────────────────

function loadTaxonomy() {
  const csvPath = join(__dirname, '..', 'pc-parts-complete.csv');
  const rows = parseCSV(csvPath);
  const taxonomy = buildTaxonomy(rows);
  console.log(`Taxonomy loaded: ${taxonomy.productLookup.length} products, ${taxonomy.allProducts.length} total nodes`);

  // Build a quick lookup table for fast matching
  const lookupTable = new Map();
  for (const entry of taxonomy.productLookup) {
    for (const key of entry.searchKeys) {
      if (!lookupTable.has(key)) lookupTable.set(key, []);
      lookupTable.get(key).push(entry);
    }
  }
  taxonomy.lookupTable = lookupTable;

  return taxonomy;
}

// Export for use in convert-data.js
export { loadTaxonomy, findTaxonomyMatch, getFrontendCategory, normalizeScrapedName, extractModelIdentifiers };

// ──────────────────────────────────────────────────────────
//  5. MAIN (build taxonomy cache)
// ──────────────────────────────────────────────────────────

function main() {
  const taxonomy = loadTaxonomy();

  // Save taxonomy cache for fast loading
  const cachePath = join(__dirname, '..', 'public', 'data', 'taxonomy-cache.json');
  const cache = {
    productLookup: taxonomy.productLookup.map(p => ({
      id: p.id,
      name: p.name,
      model: p.model,
      brand: p.brand,
      category: p.category,
      key_specs: p.key_specs,
      interface_socket: p.interface_socket,
      release_year: p.release_year,
      price_usd: p.price_usd,
      searchKeys: p.searchKeys,
      path: p.path.map(n => ({ type: n.type, name: n.name, category: n.category })),
    })),
    buildTime: new Date().toISOString(),
  };
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`Taxonomy cache saved to ${cachePath}`);

  // Quick test matches
  console.log('\n--- Testing matches ---');
  const testProducts = [
    'MSI GeForce RTX 5080 16GB OC Inspire X3',
    'Intel Core i5-14600K 14C/20T 3.5GHz',
    'Corsair Vengeance DDR5 32GB 6000MHz',
    'Samsung 990 Pro 2TB NVMe SSD',
    'ASUS ROG Strix G15 Ryzen 9 RTX 3060',
    'Cooler Master Hyper 212 Air Cooler',
  ];

  for (const test of testProducts) {
    const result = findTaxonomyMatch(test, taxonomy);
    if (result) {
      const cat = getFrontendCategory(result.match.path);
      console.log(`✅ "${test}" → ${result.match.name} (${cat || 'unknown'}) [score: ${result.score}]`);
    } else {
      console.log(`❌ "${test}" → No match`);
    }
  }
}

main();
