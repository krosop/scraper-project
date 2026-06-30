import type { PriceView } from '@/supabase/types';

// =============================================================================
// SYNONYM EXPANSION — Map concepts to all equivalent terms
// =============================================================================

const SYNONYM_GROUPS: string[][] = [
  // GPU / Graphics Card
  ['gpu', 'graphics', 'card', 'vga', 'carte', 'graphique', 'grafica', 'video', 'видео', 'كرت', 'شاشة'],
  // CPU / Processor
  ['cpu', 'processor', 'processeur', 'procesador', 'معالج', 'بروسيسور'],
  // RAM / Memory
  ['ram', 'memory', 'memoire', 'memoria', 'ddr', 'ذاكرة', 'رام'],
  // SSD / Storage
  ['ssd', 'solid', 'state', 'nvme', 'm2', 'm.2', 'قرص', 'صلب', 'تخزين'],
  // HDD / Hard Drive
  ['hdd', 'hard', 'disk', 'drive', 'disque', 'dur', 'hdd', 'قرص', 'ص硬性'],
  // Monitor / Screen
  ['monitor', 'screen', 'ecran', 'display', 'pantalla', 'شاشة', 'monitor'],
  // Motherboard
  ['motherboard', 'carte', 'mere', 'placa', 'base', 'mainboard', 'لوحة', 'أم'],
  // Power Supply
  ['psu', 'power', 'supply', 'alimentation', 'fuente', 'poder', 'amper', 'alim', 'طاقة', 'باور'],
  // Case / Chassis
  ['case', 'boitier', 'chassis', 'caja', 'caisse', 'غلاف', 'كيس'],
  // Cooling
  ['cooler', 'cooling', 'refroidissement', 'ventilateur', 'fan', 'watercooling', 'aio', 'refrigeracion', 'تبريد', 'مبرد'],
  // Keyboard
  ['keyboard', 'clavier', 'teclado', 'لوحة', 'مفاتيح', 'كيبورد'],
  // Mouse
  ['mouse', 'souris', 'raton', 'souris', 'فأرة', 'ماوس'],
  // Headset
  ['headset', 'casque', 'auriculares', 'headphone', 'écouteur', 'سماعة', 'كاسك'],
  // Laptop
  ['laptop', 'notebook', 'portable', 'ordinateur', 'portable', 'pc', 'portatil', 'portable', 'لابتوب', 'حاسوب', 'محمول'],
  // Desktop / PC
  ['desktop', 'pc', 'ordinateur', 'computadora', 'ordenador', ' bureau', 'حاسوب', 'مكتبي', 'كمبيوتر'],
  // Gaming
  ['gaming', 'gamer', 'jeu', 'juego', 'jeux', 'العاب', 'جيمنج', 'قيمنق'],
];

const SYNONYM_MAP: Map<string, Set<string>> = new Map();
for (const group of SYNONYM_GROUPS) {
  const normalizedGroup = group.map(w => w.toLowerCase());
  for (const word of normalizedGroup) {
    if (!SYNONYM_MAP.has(word)) SYNONYM_MAP.set(word, new Set());
    for (const other of normalizedGroup) {
      if (other !== word) SYNONYM_MAP.get(word)!.add(other);
    }
  }
}

function getSynonyms(word: string): string[] {
  const set = SYNONYM_MAP.get(word.toLowerCase());
  return set ? Array.from(set) : [];
}

// =============================================================================
// KEYBOARD DISTANCE — QWERTY adjacency for typo tolerance
// =============================================================================

const KEYBOARD_ADJACENT: Record<string, string[]> = {
  'q': ['w','a','s','1','2'],
  'w': ['q','e','s','a','d','2','3'],
  'e': ['w','r','d','s','f','3','4'],
  'r': ['e','t','f','d','g','4','5'],
  't': ['r','y','g','f','h','5','6'],
  'y': ['t','u','h','g','j','6','7'],
  'u': ['y','i','j','h','k','7','8'],
  'i': ['u','o','k','j','l','8','9'],
  'o': ['i','p','l','k','m','9','0'],
  'p': ['o','l','m','0','-'],
  'a': ['q','w','s','z','x'],
  's': ['q','w','e','a','d','z','x','c'],
  'd': ['w','e','r','s','f','x','c','v'],
  'f': ['e','r','t','d','g','c','v','b'],
  'g': ['r','t','y','f','h','v','b','n'],
  'h': ['t','y','u','g','j','b','n','m'],
  'j': ['y','u','i','h','k','n','m',','],
  'k': ['u','i','o','j','l','m',',','.'],
  'l': ['i','o','p','k','m',',','.','/'],
  'z': ['a','s','x'],
  'x': ['a','s','d','z','c'],
  'c': ['s','d','f','x','v'],
  'v': ['d','f','g','c','b'],
  'b': ['f','g','h','v','n'],
  'n': ['g','h','j','b','m'],
  'm': ['h','j','k','n',','],
  '1': ['q','2'],
  '2': ['1','q','w','3'],
  '3': ['2','w','e','4'],
  '4': ['3','e','r','5'],
  '5': ['4','r','t','6'],
  '6': ['5','t','y','7'],
  '7': ['6','y','u','8'],
  '8': ['7','u','i','9'],
  '9': ['8','i','o','0'],
  '0': ['9','o','p'],
};

function keyboardDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length !== b.length) return Infinity;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i].toLowerCase();
    const cb = b[i].toLowerCase();
    if (ca === cb) continue;
    const adj = KEYBOARD_ADJACENT[ca];
    if (adj && adj.includes(cb)) {
      total += 0.5; // Adjacent key typo
    } else {
      total += 1; // Non-adjacent = full substitution cost
    }
  }
  return total;
}

// =============================================================================
// PHONETIC MATCHING — Simplified Soundex + Arabic transliteration patterns
// =============================================================================

function phoneticHash(word: string): string {
  // Simplified phonetic hash: collapse similar-sounding consonants
  return word
    .toLowerCase()
    .replace(/[ckq]/g, 'k')
    .replace(/[sz]/g, 's')
    .replace(/[fv]/g, 'f')
    .replace(/[bp]/g, 'p')
    .replace(/[dt]/g, 't')
    .replace(/[gj]/g, 'g')
    .replace(/[iy]/g, 'i')
    .replace(/[ou]/g, 'o')
    .replace(/[ae]/g, 'e')
    .replace(/[rn]/g, 'n')
    .replace(/[w]+/g, 'w')
    .replace(/[h]+/g, 'h')
    .replace(/[^a-z]/g, '');
}

function phoneticSimilarity(a: string, b: string): number {
  const ha = phoneticHash(a);
  const hb = phoneticHash(b);
  if (ha === hb) return 1;
  // Check if one is a prefix of the other phonetically
  if (ha.startsWith(hb) || hb.startsWith(ha)) return 0.7;
  // Levenshtein on phonetic hashes
  const dist = levenshtein(ha, hb);
  const maxLen = Math.max(ha.length, hb.length);
  if (maxLen === 0) return 1;
  return Math.max(0, 1 - dist / maxLen);
}

// =============================================================================
// LEVENSHTEIN — Standard edit distance
// =============================================================================

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev: number[] = new Array(n + 1);
  const curr: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : Math.min(prev[j - 1] + 1, curr[j - 1] + 1, prev[j] + 1);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// =============================================================================
// NORMALIZATION & TOKENIZATION
// =============================================================================

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\d.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Spec patterns: numbers with units
const SPEC_PATTERN = /(\d+(?:\.\d+)?)\s*(gb|tb|mb|mhz|ghz|hz|w|watt|v| inch|"|mm|cm|k|ko|mo|go|°c|rpm|fps|mp|px|x\d+|core|thread|pin|modular|bit|channel|ms|hz|polegada|pouces|polegadas|pulgadas|pouces|zoll|pollici|дюйм|インチ|英寸)/gi;

export function tokenize(text: string): string[] {
  const normalized = normalize(text);
  // Extract specs before splitting
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  const specRegex = new RegExp(SPEC_PATTERN.source, 'gi');
  while ((m = specRegex.exec(normalized)) !== null) {
    specs.push(`${m[1]}${m[2].toLowerCase().replace(/\s/g, '')}`);
  }
  // Also keep raw number tokens for matching
  const rawTokens = normalized.split(' ').filter(w => w.length >= 1);
  // Extract standalone numbers
  const numbers = rawTokens.filter(t => /^\d+(?:\.\d+)?$/.test(t));
  return [...new Set([...rawTokens, ...specs, ...numbers])];
}

export function extractSpecs(text: string): Array<{ value: number; unit: string; raw: string }> {
  const specs: Array<{ value: number; unit: string; raw: string }> = [];
  const regex = new RegExp(SPEC_PATTERN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    specs.push({
      value: parseFloat(m[1]),
      unit: m[2].toLowerCase().replace(/\s/g, '').replace(/[\"]/g, 'inch').replace(/ko|mo|go/g, (s) => s.replace('o', 'b')),
      raw: m[0],
    });
  }
  return specs;
}

// =============================================================================
// PRICE RANGE PARSING
// =============================================================================

export interface PriceFilter {
  min?: number;
  max?: number;
}

export function parsePriceFilter(query: string): { cleanQuery: string; priceFilter: PriceFilter | null } {
  const pricePatterns = [
    // "under 100000", "below 100k", "less than 100000", "moins de 100000", "أقل من 100000"
    { regex: /(?:under|below|less than|moins de|أقل من|moins|moins que|inférieur à|inferieur a|less|cheaper than|max|maximum|at most|au plus|au maximum)\s*(\d+(?:[\s.,]?\d{3})*)\s*(k?)/i, type: 'max' as const },
    // "over 50000", "above 50000", "more than 50000", "plus de 50000", "أكثر من 50000"
    { regex: /(?:over|above|more than|plus de|أكثر من|plus|au moins|at least|minimum|min|starting from|à partir de| partir de|from)\s*(\d+(?:[\s.,]?\d{3})*)\s*(k?)/i, type: 'min' as const },
    // "between 50000 and 100000", "entre 50000 et 100000", "50000 to 100000"
    { regex: /(?:between|entre|from|de)\s*(\d+(?:[\s.,]?\d{3})*)\s*(?:and|to|et|à|a)\s*(\d+(?:[\s.,]?\d{3})*)\s*(k?)/i, type: 'range' as const },
    // "50000-100000", "50k-100k"
    { regex: /(\d+(?:[\s.,]?\d{3})*)\s*(k?)\s*[-–]\s*(\d+(?:[\s.,]?\d{3})*)\s*(k?)/i, type: 'range' as const },
  ];

  let priceFilter: PriceFilter | null = null;
  let cleanQuery = query;

  for (const pattern of pricePatterns) {
    const match = cleanQuery.match(pattern.regex);
    if (!match) continue;

    const parseNum = (s: string, k: string): number => {
      const n = parseInt(s.replace(/[\s.,]/g, ''), 10);
      return k.toLowerCase() === 'k' ? n * 1000 : n;
    };

    if (pattern.type === 'max') {
      const max = parseNum(match[1], match[2] || '');
      priceFilter = { max };
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    } else if (pattern.type === 'min') {
      const min = parseNum(match[1], match[2] || '');
      priceFilter = { min };
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    } else if (pattern.type === 'range') {
      const min = parseNum(match[1], match[2] || '');
      const max = parseNum(match[3], match[4] || '');
      priceFilter = { min, max };
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    }
    break; // Only parse first price filter
  }

  return { cleanQuery, priceFilter };
}

// =============================================================================
// BRAND + MODEL DETECTION
// =============================================================================

const BRAND_NAMES = new Set([
  'asus', 'msi', 'gigabyte', 'asrock', 'evga', 'zotac', 'sapphire', 'xfx',
  'powercolor', 'palit', 'pny', 'biostar', 'colorful', 'galax', 'inno3d',
  'gainward', 'yeston', 'maxsun', 'intel', 'amd', 'ryzen', 'core', 'corsair',
  'gskill', 'kingston', 'crucial', 'samsung', 'wd', 'seagate', 'toshiba',
  'thermaltake', 'cooler', 'master', 'nzxt', 'bequiet', 'noctua', 'deepcool',
  'lian', 'fractal', 'phanteks', 'logitech', 'razer', 'hyperx', 'steelseries',
  'roccat', 'adata', 'team', 'tforce', 'lexar', 'apacer', 'ocpc', 'nvidia',
  'geforce', 'radeon', 'seasonic', 'corsair', 'silverstone', 'antec', 'enermax',
  'sharkoon', 'aerocool', 'kolink', 'mars', 'gaming', 'philips', 'aoc', 'dell',
  'hp', 'lenovo', 'acer', 'lg', 'samsung', 'viewsonic', 'benq', 'msi', 'asus',
  'apple', 'macbook', 'imac', 'mac', 'surface', 'thinkpad', 'ideapad', 'predator',
  'omen', 'victus', 'pavilion', 'envy', 'spectre', 'xps', 'alienware', 'g',
  'legion', 'thinkbook', 'yoga', 'swift', 'aspire', 'nitro', 'tuf', 'rog',
  'strix', 'zephyrus', 'flow', 'proart', 'vivobook', 'zenbook', 'expertbook',
  'chromebook', 'pixelbook', 'surface', 'dell', 'latitude', 'precision', 'inspiron',
  'vostro', 'optiplex', 'xps', 'alienware', 'g', 'aurora', 'g5', 'g7', 'g15',
]);

const GPU_MODELS = new Set([
  'rtx', 'gtx', 'rx', 'gt', 'radeon', 'geforce', 'quadro', 'tesla', 'arc',
  '4060', '4070', '4080', '4090', '3060', '3070', '3080', '3090', '3050',
  '2060', '2070', '2080', '1060', '1070', '1080', '1050', '1030', '1650', '1660',
  '6600', '6650', '6700', '6750', '6800', '6850', '6900', '6950', '7600', '7700', '7800', '7900',
  '5500', '5600', '5700', '580', '590', ' Vega', 'Vega', ' Fury', 'Fury',
  '6400', '6500', '6300',
]);

const CPU_MODELS = new Set([
  'i3', 'i5', 'i7', 'i9', 'ryzen', 'threadripper', 'athlon', 'pentium', 'celeron',
  '11900', '12900', '13900', '14900', '10900', '9900', '9700', '9600', '9400', '8700', '8600', '8400',
  '5950', '5900', '5800', '5700', '5600', '5500', '3950', '3900', '3800', '3700', '3600', '3500',
  '7950', '7900', '7800', '7700', '7600', '7500', '7450', '7400', '7350', '7300', '7280', '7200',
  '9950', '9900', '9800', '9700', '9600', '9500', '9400', '9300', '9200', '9100',
]);

const RAM_MODELS = new Set([
  'ddr3', 'ddr4', 'ddr5', 'lpddr', 'ecc',
  'dominator', 'vengeance', 'fury', 'beast', 'ripjaws', 'trident', 'flare',
  'renegade', 'predator', 'toughram', 'aegis', 'value', 'select', 'hyperx',
]);

const SSD_MODELS = new Set([
  'sn', '870', '980', '990', '970', '860', '850', '840', 'pm', 'sm',
  'mx', 'bx', 'mp', 'sp', 'cs', 'nm', 'wd', 'black', 'blue', 'green', 'red',
  'gold', 'firecuda', 'barracuda', 'ironwolf', 'skyhawk', 'exos',
]);

const PSU_MODELS = new Set([
  'rm', 'tx', 'cx', 'vs', 'gs', 'sf', 'ax', 'hx', 'focus', 'prime', 'toughpower',
  'smart', 'pure', 'bn', 'be', 'dq', 'gm', 'tg', 'pg', 'rev', 'superflower',
]);

const MONITOR_MODELS = new Set([
  '240hz', '144hz', '120hz', '165hz', '180hz', '200hz', '280hz', '360hz', '480hz', '60hz', '75hz', '100hz',
  '1080p', '1440p', '2k', '4k', '4k', '5k', '8k', 'ultrawide', 'curved', 'ips', 'va', 'tn',
  'oled', 'qled', 'mini', 'led', 'nano', 'ips', 'fast', '1ms', 'hdr', 'g-sync', 'freesync', 'sync',
  '24', '27', '32', '34', '38', '49', '240', '144', '120', '165', '180', '200', '280', '360', '480',
]);

interface BrandModelPair {
  brand: string;
  model: string;
  raw: string;
}

function detectBrandModelPairs(text: string): BrandModelPair[] {
  const tokens = tokenize(text);
  const pairs: BrandModelPair[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const t1 = tokens[i];
    const t2 = tokens[i + 1];
    const combined = `${t1} ${t2}`;
    const combinedNoSpace = `${t1}${t2}`;

    // Brand + GPU model (e.g., "Asus RTX 4060")
    if (BRAND_NAMES.has(t1) && GPU_MODELS.has(t2)) {
      pairs.push({ brand: t1, model: t2, raw: combined });
    }
    // Brand + CPU model (e.g., "Intel i5")
    if (BRAND_NAMES.has(t1) && CPU_MODELS.has(t2)) {
      pairs.push({ brand: t1, model: t2, raw: combined });
    }
    // "RTX 4060" (GPU series + model)
    if (t1 === 'rtx' && /^\d{3,4}/.test(t2)) {
      pairs.push({ brand: 'rtx', model: t2, raw: combined });
    }
    if (t1 === 'gtx' && /^\d{3,4}/.test(t2)) {
      pairs.push({ brand: 'gtx', model: t2, raw: combined });
    }
    if (t1 === 'rx' && /^\d{3,4}/.test(t2)) {
      pairs.push({ brand: 'rx', model: t2, raw: combined });
    }
    // "Ryzen 5" or "Ryzen 7"
    if (t1 === 'ryzen' && /^[3579]$/.test(t2)) {
      pairs.push({ brand: 'ryzen', model: t2, raw: combined });
    }
    // "Core i5", "Core i7"
    if (t1 === 'core' && /^i[3579]$/.test(t2)) {
      pairs.push({ brand: 'core', model: t2, raw: combined });
    }
    // "DDR4", "DDR5"
    if (t1 === 'ddr' && /^[345]$/.test(t2)) {
      pairs.push({ brand: 'ddr', model: t2, raw: combinedNoSpace });
    }
    // Brand + RAM model (e.g., "Corsair Dominator")
    if (BRAND_NAMES.has(t1) && RAM_MODELS.has(t2)) {
      pairs.push({ brand: t1, model: t2, raw: combined });
    }
    // Brand + SSD model (e.g., "Samsung 870")
    if (BRAND_NAMES.has(t1) && SSD_MODELS.has(t2)) {
      pairs.push({ brand: t1, model: t2, raw: combined });
    }
    // Brand + PSU model (e.g., "Corsair RM")
    if (BRAND_NAMES.has(t1) && PSU_MODELS.has(t2)) {
      pairs.push({ brand: t1, model: t2, raw: combined });
    }
    // Monitor specs (e.g., "144Hz", "4K")
    if (MONITOR_MODELS.has(t1)) {
      pairs.push({ brand: 'monitor', model: t1, raw: t1 });
    }
    // "16GB" etc
    if (/^\d+$/.test(t1) && /^(gb|tb|mb|mhz|ghz|hz|w)$/.test(t2)) {
      pairs.push({ brand: t1, model: t2, raw: combinedNoSpace });
    }
  }
  return pairs;
}

// =============================================================================
// SEARCH INDEX — Precomputed inverted index for O(1) token lookups
// =============================================================================

export interface SearchIndex {
  tokenMap: Map<string, Set<string>>; // token → product_ids
  productTokens: Map<string, string[]>; // product_id → tokens
  productSpecs: Map<string, Array<{ value: number; unit: string; raw: string }>>;
  productNames: Map<string, string>;
  productPrices: Map<string, number>;
  productCategories: Map<string, string>;
}

export function buildSearchIndex(products: PriceView[]): SearchIndex {
  const tokenMap = new Map<string, Set<string>>();
  const productTokens = new Map<string, string[]>();
  const productSpecs = new Map<string, Array<{ value: number; unit: string; raw: string }>>();
  const productNames = new Map<string, string>();
  const productPrices = new Map<string, number>();
  const productCategories = new Map<string, string>();

  for (const p of products) {
    const id = p.product_id;
    const searchText = `${p.product_name} ${p.product_brand || ''} ${p.category_name_fr || ''} ${p.store_name || ''}`;
    const tokens = tokenize(searchText);
    const specs = extractSpecs(searchText);

    productTokens.set(id, tokens);
    productSpecs.set(id, specs);
    productNames.set(id, p.product_name);
    productPrices.set(id, p.current_price);
    productCategories.set(id, p.category_slug || '');

    for (const token of tokens) {
      if (!tokenMap.has(token)) tokenMap.set(token, new Set());
      tokenMap.get(token)!.add(id);
    }
  }

  return { tokenMap, productTokens, productSpecs, productNames, productPrices, productCategories };
}

// =============================================================================
// SCORING ENGINE
// =============================================================================

export interface SearchResult<T> {
  item: T;
  score: number;
  matchReasons: string[];
}

function scoreToken(queryWord: string, targetWord: string): { score: number; reason: string } {
  const qw = queryWord.toLowerCase();
  const tw = targetWord.toLowerCase();

  // Exact match
  if (qw === tw) return { score: 100, reason: 'exact' };
  // Starts with (prefix match)
  if (tw.startsWith(qw)) return { score: 85, reason: 'prefix' };
  if (qw.startsWith(tw) && tw.length >= 2) return { score: 75, reason: 'prefix-rev' };
  // Contains
  if (tw.includes(qw)) return { score: 65, reason: 'contains' };
  if (qw.includes(tw) && tw.length >= 3) return { score: 55, reason: 'contains-rev' };

  // Synonym match
  const synonyms = getSynonyms(qw);
  if (synonyms.includes(tw)) return { score: 70, reason: 'synonym' };
  for (const syn of synonyms) {
    if (tw.startsWith(syn)) return { score: 60, reason: 'synonym-prefix' };
    if (tw.includes(syn)) return { score: 50, reason: 'synonym-contains' };
  }

  // Phonetic similarity
  const phonetic = phoneticSimilarity(qw, tw);
  if (phonetic >= 0.85) return { score: 45, reason: 'phonetic' };
  if (phonetic >= 0.7) return { score: 30, reason: 'phonetic-weak' };

  // Keyboard distance typo
  if (qw.length >= 3 && tw.length >= 3 && qw.length === tw.length) {
    const kbd = keyboardDistance(qw, tw);
    if (kbd <= 1) return { score: 50, reason: 'keyboard' };
    if (kbd <= 1.5) return { score: 35, reason: 'keyboard-weak' };
  }

  // Levenshtein fuzzy
  const dist = levenshtein(qw, tw);
  const tolerance = Math.max(1, Math.floor(Math.max(qw.length, tw.length) / 4));
  if (dist <= tolerance && dist <= 2 && qw.length >= 3) {
    return { score: 40 - dist * 10, reason: 'fuzzy' };
  }

  return { score: 0, reason: 'none' };
}

// =============================================================================
// MAIN SEARCH FUNCTION
// =============================================================================

export function smartSearch(
  products: PriceView[],
  query: string,
  index: SearchIndex | null
): SearchResult<PriceView>[] {
  if (!query.trim()) {
    return products.map(p => ({ item: p, score: 0, matchReasons: [] }));
  }

  // Parse price filters
  const { cleanQuery, priceFilter } = parsePriceFilter(query);
  const rawQuery = cleanQuery.trim();
  if (!rawQuery && !priceFilter) {
    return products.map(p => ({ item: p, score: 0, matchReasons: [] }));
  }

  // Detect brand+model pairs from query
  const queryPairs = detectBrandModelPairs(rawQuery);
  const queryWords = tokenize(rawQuery);
  const querySpecs = extractSpecs(rawQuery);

  // Use index if available for fast candidate selection
  let candidateIds: Set<string> | null = null;
  if (index && queryWords.length > 0) {
    for (const qw of queryWords) {
      const ids = index.tokenMap.get(qw);
      if (ids) {
        if (candidateIds === null) {
          candidateIds = new Set(ids);
        } else {
          // Union — keep all that match any token
          for (const id of ids) candidateIds.add(id);
        }
      }
    }
  }

  const candidates: PriceView[] = candidateIds
    ? products.filter(p => candidateIds!.has(p.product_id))
    : products;

  const results: SearchResult<PriceView>[] = [];

  for (const item of candidates) {
    // Price filter check
    if (priceFilter) {
      const price = item.current_price;
      if (priceFilter.min !== undefined && price < priceFilter.min) continue;
      if (priceFilter.max !== undefined && price > priceFilter.max) continue;
    }

    const searchText = `${item.product_name} ${item.product_brand || ''} ${item.category_name_fr || ''} ${item.store_name || ''}`;
    const targetWords = index?.productTokens.get(item.product_id) || tokenize(searchText);
    const targetSpecs = index?.productSpecs.get(item.product_id) || extractSpecs(searchText);

    let totalScore = 0;
    let matchedWords = 0;
    const matchReasons: string[] = [];

    // Score each query word against target tokens
    for (const qw of queryWords) {
      let bestScore = 0;
      let bestReason = 'none';
      for (const tw of targetWords) {
        const { score, reason } = scoreToken(qw, tw);
        if (score > bestScore) {
          bestScore = score;
          bestReason = reason;
        }
      }
      if (bestScore > 0) {
        totalScore += bestScore;
        matchedWords++;
        if (bestReason !== 'none' && !matchReasons.includes(bestReason)) {
          matchReasons.push(bestReason);
        }
      }
    }

    // Spec matching bonus
    for (const qs of querySpecs) {
      for (const ts of targetSpecs) {
        if (qs.unit === ts.unit || isUnitAlias(qs.unit, ts.unit)) {
          const diff = Math.abs(qs.value - ts.value);
          const avg = (qs.value + ts.value) / 2;
          if (diff === 0) {
            totalScore += 80; // Exact spec match
            if (!matchReasons.includes('spec-exact')) matchReasons.push('spec-exact');
          } else if (diff / avg <= 0.1) {
            totalScore += 50; // Within 10%
            if (!matchReasons.includes('spec-close')) matchReasons.push('spec-close');
          } else if (diff / avg <= 0.25) {
            totalScore += 25; // Within 25%
            if (!matchReasons.includes('spec-near')) matchReasons.push('spec-near');
          }
        }
      }
    }

    // Brand+model pair bonus
    const itemPairs = detectBrandModelPairs(searchText);
    for (const qp of queryPairs) {
      for (const ip of itemPairs) {
        if (qp.brand === ip.brand && qp.model === ip.model) {
          totalScore += 120; // Exact brand+model pair
          if (!matchReasons.includes('brand-model')) matchReasons.push('brand-model');
        } else if (qp.brand === ip.brand) {
          totalScore += 40; // Same brand
          if (!matchReasons.includes('brand')) matchReasons.push('brand');
        } else if (qp.model === ip.model) {
          totalScore += 60; // Same model
          if (!matchReasons.includes('model')) matchReasons.push('model');
        }
      }
    }

    // Full phrase match bonus
    const normQuery = normalize(rawQuery);
    const normText = normalize(searchText);
    if (normText.includes(normQuery)) {
      totalScore += 60;
      if (!matchReasons.includes('phrase')) matchReasons.push('phrase');
    }

    // All words matched bonus
    if (matchedWords === queryWords.length && queryWords.length > 0) {
      totalScore += 30;
      if (!matchReasons.includes('all-words')) matchReasons.push('all-words');
    }

    // Category match bonus (if query contains a category word)
    const categoryWords = ['gpu', 'graphics', 'cpu', 'processor', 'ram', 'memory', 'ssd', 'hdd', 'monitor', 'screen', 'motherboard', 'psu', 'power', 'case', 'cooler', 'keyboard', 'mouse', 'headset', 'laptop', 'desktop'];
    for (const cw of categoryWords) {
      if (queryWords.includes(cw) && targetWords.includes(cw)) {
        totalScore += 20;
        if (!matchReasons.includes('category')) matchReasons.push('category');
        break;
      }
    }

    if (totalScore > 0) {
      results.push({ item, score: totalScore, matchReasons });
    }
  }

  // If no results from indexed search, fall back to full scan (only if we used index)
  if (results.length === 0 && candidateIds !== null) {
    return smartSearch(products, query, null);
  }

  // Category intent: detect what category the user is searching for
  const categoryIntent = detectCategoryIntent(rawQuery);

  // Apply category priority boost + penalty for better category targeting
  if (categoryIntent.length > 0) {
    const isComponentIntent = categoryIntent.some(c =>
      c === 'graphics-cards' || c === 'processors' || c === 'memory' ||
      c === 'storage' || c === 'monitors' || c === 'power-supplies' ||
      c === 'cases' || c === 'cooling' || c === 'keyboard' || c === 'mouse' || c === 'headset'
    );
    for (const r of results) {
      const catSlug = r.item.category_slug || '';
      const idx = categoryIntent.indexOf(catSlug);
      if (idx !== -1) {
        // Very strong boost for matching intended category (+500 for first, +400 for second, etc.)
        r.score += (categoryIntent.length - idx) * 500;
        r.matchReasons.push('cat-priority');
      } else if (isComponentIntent && catSlug === 'pc-parts') {
        // SEVERE penalty for laptops / generic pc-parts when searching for a specific component
        r.score -= 800;
        r.matchReasons.push('cat-mismatch');
      } else if (isComponentIntent && catSlug !== '') {
        // Moderate penalty for other non-matching categories
        r.score -= 200;
        r.matchReasons.push('cat-mismatch');
      }
    }
  }

  // Secondary sort: by score (primary), category priority (secondary), then review count, then price
  return results.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    // Category priority: component categories (GPU, CPU, etc.) before pc-parts (laptops)
    const catPriority = (slug: string) => {
      const priorities: Record<string, number> = {
        'graphics-cards': 10, 'processors': 9, 'memory': 8, 'storage': 7,
        'monitors': 6, 'power-supplies': 5, 'cases': 4, 'cooling': 3,
        'keyboard': 2, 'mouse': 2, 'headset': 1,
      };
      return priorities[slug] || 0;
    };
    const catDiff = catPriority(b.item.category_slug || '') - catPriority(a.item.category_slug || '');
    if (catDiff !== 0) return catDiff;
    const reviewDiff = (b.item.product_review_count || 0) - (a.item.product_review_count || 0);
    if (reviewDiff !== 0) return reviewDiff;
    return (a.item.current_price || 0) - (b.item.current_price || 0);
  });
}

// Detect which category the user is searching for based on query keywords
function detectCategoryIntent(query: string): string[] {
  const words = tokenize(query);
  const intents: string[] = [];

  const gpuTerms = ['rtx', 'gtx', 'radeon', 'geforce', 'gpu', 'vga', 'graphics', 'carte', 'graphique', 'nvidia', 'amd', '4060', '4070', '4080', '4090', '3060', '3070', '3080', '3090', '5060', '5070', '5080', '5090', '3050', '5050', '2060', '2070', '2080', '1660', '1650', '1080', '1070', '1060', '1050', '6600', '6700', '6800', '6900', '7600', '7700', '7800', '7900', '9070', 'rx', 'gt', 'quadro', 'tesla', 'arc'];
  if (words.some(w => gpuTerms.includes(w))) intents.push('graphics-cards');

  const cpuTerms = ['cpu', 'processor', 'processeur', 'procesador', 'i3', 'i5', 'i7', 'i9', 'ultra', 'ultra 5', 'ultra 7', 'ultra 9', 'ryzen', 'core', 'threadripper', 'athlon', 'pentium', 'celeron', '10100', '10400', '10600', '10700', '10900', '11400', '11600', '11700', '11900', '12100', '12400', '12600', '12700', '12900', '13100', '13400', '13600', '13700', '13900', '14400', '14600', '14700', '14900', '5300', '5500', '5600', '5700', '5800', '5900', '5950', '7600', '7700', '7800', '7900', '7950', '9600', '9700', '9800', '9900', '9950'];
  if (words.some(w => cpuTerms.includes(w))) intents.push('processors');

  const ramTerms = ['ram', 'memory', 'memoire', 'memoria', 'ddr', 'ddr3', 'ddr4', 'ddr5', 'lpddr', 'ecc', 'dominator', 'vengeance', 'fury', 'beast', 'ripjaws', 'trident', 'flare', 'renegade', 'predator', 'toughram', 'aegis', 'value', 'select', 'hyperx', 'xpg', 'adata', 'corsair', 'gskill', 'g.skill', 'kingston', 'crucial', 'teamgroup', 'tforce', 'lexar', 'apacer', 'ocpc', '16gb', '32gb', '64gb', '8gb', '4gb', '128gb', '3200', '3600', '4800', '5200', '5600', '6000', '6400', '7200', 'mhz', 'mt/s'];
  if (words.some(w => ramTerms.includes(w))) intents.push('memory');

  const storageTerms = ['ssd', 'hdd', 'nvme', 'm2', 'm.2', 'solid', 'hard', 'disk', 'disque', 'sata', 'sn850', 'sn770', 'sn570', 'sn500', '980', '990', '970', '870', '860', '850', '840', 'pm', 'sm', 'mx', 'bx', 'mp', 'sp', 'cs', 'nm', 'wd', 'western', 'seagate', 'samsung', 'crucial', 'kingston', 'teamgroup', 'sabrent', '1tb', '2tb', '4tb', '500gb', '250gb', '128gb', 'gen4', 'gen5', 'pcie', '2280', '2242'];
  if (words.some(w => storageTerms.includes(w))) intents.push('storage');

  const monitorTerms = ['monitor', 'ecran', 'display', 'screen', '144hz', '240hz', '165hz', 'ips', 'oled', 'va', 'tn', 'ultrawide', 'curved', '27', '32', '24'];
  if (words.some(w => monitorTerms.includes(w))) intents.push('monitors');

  const mbTerms = ['motherboard', 'carte', 'mere', 'placa', 'base', 'mainboard', 'b650', 'z790', 'x670', 'b550', 'z690'];
  if (words.some(w => mbTerms.includes(w))) intents.push('pc-parts');

  const psuTerms = ['psu', 'alimentation', 'power', 'supply', 'rm', 'tx', 'cx', 'ax', 'hx', 'watt', '750w', '850w', '650w'];
  if (words.some(w => psuTerms.includes(w))) intents.push('power-supplies');

  const caseTerms = ['case', 'boitier', 'chassis', 'caja', 'tower', 'mid', 'full', 'atx', 'micro'];
  if (words.some(w => caseTerms.includes(w))) intents.push('cases');

  const coolingTerms = ['cooler', 'cooling', 'refroidissement', 'ventilateur', 'fan', 'watercooling', 'aio', 'radiator', 'heatsink'];
  if (words.some(w => coolingTerms.includes(w))) intents.push('cooling');

  const kbTerms = ['keyboard', 'clavier', 'teclado', 'mechanical', 'mecanique'];
  if (words.some(w => kbTerms.includes(w))) intents.push('keyboard');

  const mouseTerms = ['mouse', 'souris', 'raton'];
  if (words.some(w => mouseTerms.includes(w))) intents.push('mouse');

  const laptopTerms = ['laptop', 'notebook', 'portable', 'ordinateur'];
  if (words.some(w => laptopTerms.includes(w))) intents.push('pc-parts');

  return intents;
}

function isUnitAlias(a: string, b: string): boolean {
  const aliases: Record<string, string[]> = {
    'gb': ['gb', 'go', 'gig', 'giga'],
    'tb': ['tb', 'to', 'tera'],
    'mb': ['mb', 'mo', 'mega'],
    'mhz': ['mhz', 'mhz'],
    'ghz': ['ghz', 'ghz'],
    'hz': ['hz', 'hz'],
    'w': ['w', 'watt', 'watts'],
    'inch': ['inch', '"', 'polegada', 'pouces', 'pulgadas', 'zoll', 'pollici', 'дюйм', 'インチ', '英寸'],
  };
  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();
  if (aNorm === bNorm) return true;
  for (const [base, alts] of Object.entries(aliases)) {
    const set = new Set([base, ...alts]);
    if (set.has(aNorm) && set.has(bNorm)) return true;
  }
  return false;
}

// =============================================================================
// SUGGESTIONS
// =============================================================================

export function getSuggestions(
  productNames: string[],
  prefix: string,
  limit: number = 5
): string[] {
  if (!prefix.trim() || prefix.length < 2) return [];
  const prefixNorm = normalize(prefix);
  const prefixTokens = tokenize(prefix);

  const scored = productNames.map(name => {
    const nameNorm = normalize(name);
    const nameTokens = tokenize(name);
    let score = 0;

    // Exact prefix match on full name
    if (nameNorm.startsWith(prefixNorm)) score += 100;
    else if (nameNorm.includes(prefixNorm)) score += 70;

    // Token-level scoring
    for (const pt of prefixTokens) {
      for (const nt of nameTokens) {
        if (nt === pt) score += 50;
        else if (nt.startsWith(pt)) score += 40;
        else {
          const { score: s } = scoreToken(pt, nt);
          score += s * 0.3;
        }
      }
    }

    return { name, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.name);
}

// =============================================================================
// QUERY INTENT DETECTION (for UI hints)
// =============================================================================

export interface QueryIntent {
  type: 'product' | 'price_range' | 'category' | 'brand' | 'spec' | 'mixed';
  priceFilter: PriceFilter | null;
  brands: string[];
  specs: Array<{ value: number; unit: string }>;
  categories: string[];
}

export function detectQueryIntent(query: string): QueryIntent {
  const { priceFilter } = parsePriceFilter(query);
  const tokens = tokenize(query);
  const specs = extractSpecs(query);

  const brands: string[] = [];
  for (const t of tokens) {
    if (BRAND_NAMES.has(t)) brands.push(t);
  }

  const categories: string[] = [];
  const catMap: Record<string, string> = {
    'gpu': 'gpu', 'graphics': 'gpu', 'vga': 'gpu', 'carte': 'gpu',
    'cpu': 'cpu', 'processor': 'cpu', 'processeur': 'cpu',
    'ram': 'ram', 'memory': 'ram', 'memoire': 'ram',
    'ssd': 'ssd', 'hdd': 'hdd', 'hard': 'hdd',
    'monitor': 'monitor', 'screen': 'monitor', 'ecran': 'monitor',
    'motherboard': 'motherboard', 'mainboard': 'motherboard',
    'psu': 'psu', 'power': 'psu', 'alimentation': 'psu',
    'case': 'case', 'boitier': 'case',
    'cooler': 'cooler', 'cooling': 'cooler',
    'keyboard': 'keyboard', 'clavier': 'keyboard',
    'mouse': 'mouse', 'souris': 'mouse',
    'headset': 'headset', 'casque': 'headset',
    'laptop': 'laptop', 'notebook': 'laptop', 'portable': 'laptop',
  };
  for (const t of tokens) {
    if (catMap[t]) categories.push(catMap[t]);
  }

  let type: QueryIntent['type'] = 'product';
  if (priceFilter && categories.length > 0) type = 'mixed';
  else if (priceFilter) type = 'price_range';
  else if (categories.length > 0) type = 'category';
  else if (brands.length > 0) type = 'brand';
  else if (specs.length > 0) type = 'spec';

  return { type, priceFilter, brands, specs, categories };
}

// =============================================================================
// HIGHLIGHT MATCHING WORDS — Returns segments for UI rendering
// =============================================================================

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
  matchType: 'exact' | 'synonym' | 'prefix' | 'contains' | 'spec' | 'none';
}

/**
 * Highlight matching words in a product name based on the query.
 * Returns segments that can be rendered as: normal text + bold/colored text.
 */
export function highlightMatches(
  productName: string,
  query: string
): HighlightSegment[] {
  if (!query.trim() || !productName) {
    return [{ text: productName, isMatch: false, matchType: 'none' }];
  }

  const queryWords = tokenize(query);
  const querySpecs = extractSpecs(query);
  const productWords = tokenize(productName);
  const productSpecs = extractSpecs(productName);

  // Build a map of which product word positions are matched
  const matchedIndices = new Set<number>();
  const matchTypes: Map<number, HighlightSegment['matchType']> = new Map();

  // Check exact/synonym/fuzzy matches
  for (let i = 0; i < productWords.length; i++) {
    const pw = productWords[i];
    for (const qw of queryWords) {
      if (pw === qw) {
        matchedIndices.add(i);
        matchTypes.set(i, 'exact');
        break;
      }
      const synonyms = getSynonyms(qw);
      if (synonyms.includes(pw)) {
        matchedIndices.add(i);
        matchTypes.set(i, 'synonym');
        break;
      }
      if (pw.startsWith(qw) || qw.startsWith(pw)) {
        matchedIndices.add(i);
        matchTypes.set(i, 'prefix');
        break;
      }
      if (pw.includes(qw) || qw.includes(pw)) {
        matchedIndices.add(i);
        matchTypes.set(i, 'contains');
        break;
      }
      const { score } = scoreToken(qw, pw);
      if (score >= 40) {
        matchedIndices.add(i);
        matchTypes.set(i, 'contains');
        break;
      }
    }
  }

  // Check spec matches
  for (const qs of querySpecs) {
    for (let i = 0; i < productSpecs.length; i++) {
      const ps = productSpecs[i];
      if ((qs.unit === ps.unit || isUnitAlias(qs.unit, ps.unit)) && qs.value === ps.value) {
        // Find which product word contains this spec
        for (let j = 0; j < productWords.length; j++) {
          if (productWords[j].includes(String(qs.value)) || productWords[j].includes(qs.unit)) {
            matchedIndices.add(j);
            matchTypes.set(j, 'spec');
          }
        }
      }
    }
  }

  // Build segments from the original product name
  const segments: HighlightSegment[] = [];
  const rawWords = productName.split(/(\s+)/); // Keep whitespace as separate tokens

  let wordIndex = 0;
  for (const raw of rawWords) {
    if (/^\s+$/.test(raw)) {
      // Whitespace — append to previous segment or create new
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        last.text += raw;
      } else {
        segments.push({ text: raw, isMatch: false, matchType: 'none' });
      }
      continue;
    }

    const norm = normalize(raw).trim();
    if (!norm) {
      if (segments.length > 0) segments[segments.length - 1].text += raw;
      else segments.push({ text: raw, isMatch: false, matchType: 'none' });
      continue;
    }

    const isMatch = matchedIndices.has(wordIndex);
    const mType = matchTypes.get(wordIndex) || 'none';

    if (segments.length > 0 && segments[segments.length - 1].isMatch === isMatch && segments[segments.length - 1].matchType === mType) {
      segments[segments.length - 1].text += raw;
    } else {
      segments.push({ text: raw, isMatch, matchType: mType });
    }
    wordIndex++;
  }

  // Merge adjacent segments with same match state
  const merged: HighlightSegment[] = [];
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].isMatch === seg.isMatch && merged[merged.length - 1].matchType === seg.matchType) {
      merged[merged.length - 1].text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

// =============================================================================
// SPELL CORRECTION — "Did you mean?" for zero-result queries
// =============================================================================

export interface CorrectionSuggestion {
  original: string;
  corrected: string;
  correctedQuery: string;
  confidence: number; // 0-1
  reason: string;
}

// Known vocabulary from the catalog
let knownVocabulary: Set<string> | null = null;
let knownBrands: Set<string> | null = null;
let knownModels: Set<string> | null = null;

export function buildVocabulary(products: PriceView[]): void {
  const vocab = new Set<string>();
  const brands = new Set<string>();
  const models = new Set<string>();

  for (const p of products) {
    const name = normalize(p.product_name);
    const nameTokens = name.split(' ').filter(w => w.length >= 2);
    nameTokens.forEach(t => vocab.add(t));

    if (p.product_brand) {
      const brand = normalize(p.product_brand);
      brands.add(brand);
      vocab.add(brand);
    }

    // Extract brand from name
    for (const t of nameTokens) {
      if (BRAND_NAMES.has(t)) {
        brands.add(t);
      }
      if (GPU_MODELS.has(t) || CPU_MODELS.has(t) || RAM_MODELS.has(t) || SSD_MODELS.has(t) || PSU_MODELS.has(t) || MONITOR_MODELS.has(t)) {
        models.add(t);
      }
    }
  }

  knownVocabulary = vocab;
  knownBrands = brands;
  knownModels = models;
}

/**
 * Generate single-edit candidates from a word:
 * - deletions
 * - insertions (keyboard-adjacent only)
 * - substitutions (keyboard-adjacent only)
 * - transpositions
 */
function generateEdits(word: string): string[] {
  const edits = new Set<string>();
  const chars = word.split('');

  // Deletions
  for (let i = 0; i < chars.length; i++) {
    edits.add(chars.slice(0, i).concat(chars.slice(i + 1)).join(''));
  }

  // Insertions (keyboard-adjacent only, for realism)
  for (let i = 0; i <= chars.length; i++) {
    const adj = KEYBOARD_ADJACENT[chars[i] || chars[i - 1] || 'a'];
    if (adj) {
      for (const c of adj) {
        edits.add(chars.slice(0, i).concat(c, chars.slice(i)).join(''));
      }
    }
    // Also try common vowels
    for (const v of 'aeiou') {
      edits.add(chars.slice(0, i).concat(v, chars.slice(i)).join(''));
    }
  }

  // Substitutions (keyboard-adjacent only)
  for (let i = 0; i < chars.length; i++) {
    const adj = KEYBOARD_ADJACENT[chars[i]];
    if (adj) {
      for (const c of adj) {
        const mutated = [...chars];
        mutated[i] = c;
        edits.add(mutated.join(''));
      }
    }
  }

  // Transpositions
  for (let i = 0; i < chars.length - 1; i++) {
    const swapped = [...chars];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    edits.add(swapped.join(''));
  }

  return Array.from(edits).filter(e => e.length >= 2 && e !== word);
}

/**
 * Find the best correction for a zero-result query.
 * Returns null if no good suggestion found.
 */
export function suggestCorrection(
  query: string,
  products: PriceView[]
): CorrectionSuggestion | null {
  if (!knownVocabulary) buildVocabulary(products);
  if (!query.trim()) return null;

  const queryWords = tokenize(query);
  const candidates: Array<{ correctedQuery: string; confidence: number; reason: string }> = [];

  // Try correcting each word independently
  for (let i = 0; i < queryWords.length; i++) {
    const word = queryWords[i];
    if (word.length < 2) continue;

    // Check if this word is already in vocab — skip if it is
    if (knownVocabulary!.has(word)) continue;

    // Generate edits and score them
    const edits = generateEdits(word);
    let bestEdit = '';
    let bestScore = -1;

    for (const edit of edits) {
      if (knownVocabulary!.has(edit)) {
        const score = scoreCorrection(word, edit);
        if (score > bestScore) {
          bestScore = score;
          bestEdit = edit;
        }
      }
    }

    // Also check phonetic similarity against vocab
    if (!bestEdit) {
      for (const vocabWord of knownVocabulary!) {
        if (Math.abs(vocabWord.length - word.length) <= 2) {
          const sim = phoneticSimilarity(word, vocabWord);
          if (sim >= 0.85) {
            const score = sim * 100;
            if (score > bestScore) {
              bestScore = score;
              bestEdit = vocabWord;
            }
          }
        }
      }
    }

    // Also try keyboard distance against brands specifically
    if (!bestEdit) {
      for (const brand of knownBrands!) {
        if (Math.abs(brand.length - word.length) <= 2) {
          const kbd = keyboardDistance(word, brand);
          if (kbd <= 1.5) {
            bestEdit = brand;
            bestScore = 80 - kbd * 10;
          }
        }
      }
    }

    if (bestEdit) {
      const correctedWords = [...queryWords];
      correctedWords[i] = bestEdit;
      const correctedQuery = correctedWords.join(' ');
      const confidence = Math.min(0.95, bestScore / 100);
      candidates.push({ correctedQuery, confidence, reason: `Did you mean "${bestEdit}"?` });
    }
  }

  // Also try: whole-phrase correction (word swap, missing space)
  // e.g., "Assus" → "Asus", "Gigabite" → "Gigabyte"
  for (const vocabWord of knownVocabulary!) {
    if (vocabWord.length < 3) continue;
    const dist = levenshtein(queryWords.join(' '), vocabWord);
    if (dist <= 2 && queryWords.join(' ').length >= 4) {
      const confidence = Math.max(0.5, 1 - dist / Math.max(queryWords.join(' ').length, vocabWord.length));
      candidates.push({ correctedQuery: vocabWord, confidence, reason: `Did you mean "${vocabWord}"?` });
    }
  }

  if (candidates.length === 0) return null;

  // Pick the best candidate
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  return {
    original: query,
    corrected: best.correctedQuery,
    correctedQuery: best.correctedQuery,
    confidence: best.confidence,
    reason: best.reason,
  };
}

function scoreCorrection(original: string, candidate: string): number {
  // Higher score = better correction
  let score = 0;

  // Length similarity
  const lenDiff = Math.abs(original.length - candidate.length);
  score += Math.max(0, 20 - lenDiff * 5);

  // Prefix match bonus
  let prefixLen = 0;
  for (let i = 0; i < Math.min(original.length, candidate.length); i++) {
    if (original[i] === candidate[i]) prefixLen++;
    else break;
  }
  score += prefixLen * 3;

  // Brand match bonus
  if (knownBrands?.has(candidate)) score += 30;
  if (knownModels?.has(candidate)) score += 20;

  // Phonetic bonus
  const phonetic = phoneticSimilarity(original, candidate);
  score += phonetic * 25;

  // Keyboard distance bonus
  if (original.length === candidate.length) {
    const kbd = keyboardDistance(original, candidate);
    score += Math.max(0, 15 - kbd * 5);
  }

  return score;
}

