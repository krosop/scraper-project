// Smart fuzzy search utilities — no external dependencies

const COMMON_REPLACEMENTS: Record<string, string> = {
  'rtx': 'rtx',
  'gtx': 'gtx',
  'rx': 'rx',
  'cpu': 'cpu',
  'gpu': 'gpu',
  'ram': 'ram',
  'ssd': 'ssd',
  'hdd': 'hdd',
  'nvme': 'nvme',
  'ddr': 'ddr',
  'gb': 'gb',
  'tb': 'tb',
  'w': 'w',
  'hz': 'hz',
  'watt': 'watt',
  'inch': 'inch',
  'cm': 'cm',
  'mm': 'mm',
  'oc': 'oc',
  'ti': 'ti',
  'super': 'super',
  'xt': 'xt',
  'xtx': 'xtx',
  'pro': 'pro',
  'max': 'max',
  'plus': 'plus',
  'ultra': 'ultra',
  'gaming': 'gaming',
  'gamer': 'gamer',
  'intel': 'intel',
  'amd': 'amd',
  'ryzen': 'ryzen',
  'core': 'core',
  'i3': 'i3',
  'i5': 'i5',
  'i7': 'i7',
  'i9': 'i9',
  'asus': 'asus',
  'msi': 'msi',
  'gigabyte': 'gigabyte',
  'asrock': 'asrock',
  'zotac': 'zotac',
  'evga': 'evga',
  'sapphire': 'sapphire',
  'xfx': 'xfx',
  'powercolor': 'powercolor',
  'palit': 'palit',
  'pny': 'pny',
  'corsair': 'corsair',
  'gskill': 'gskill',
  'kingston': 'kingston',
  'crucial': 'crucial',
  'samsung': 'samsung',
  'wd': 'wd',
  'seagate': 'seagate',
  'toshiba': 'toshiba',
  'thermaltake': 'thermaltake',
  'cooler': 'cooler',
  'master': 'master',
  'nzxt': 'nzxt',
  'bequiet': 'bequiet',
  'noctua': 'noctua',
  'deepcool': 'deepcool',
  'lian': 'lian',
  'fractal': 'fractal',
  'phanteks': 'phanteks',
  'logitech': 'logitech',
  'razer': 'razer',
  'hyperx': 'hyperx',
  'steelseries': 'steelseries',
  'roccat': 'roccat',
  'adata': 'adata',
  'team': 'team',
  'tforce': 'tforce',
  'lexar': 'lexar',
  'apacer': 'apacer',
  'ocpc': 'ocpc',
  'barracuda': 'barracuda',
  'firecuda': 'firecuda',
  'ironwolf': 'ironwolf',
  'wdb': 'wdb',
  'wds': 'wds',
  'sn': 'sn',
  '870': '870',
  '980': '980',
  '990': '990',
  'matos': 'matos',
  'neonix': 'neonix',
  'magma': 'magma',
};

/** Normalize text: lowercase, remove accents, remove special chars */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into words, filter short ones, keep meaningful tokens */
export function tokenize(text: string): string[] {
  const normalized = normalize(text);
  return normalized
    .split(' ')
    .filter(w => w.length >= 1)
    .map(w => COMMON_REPLACEMENTS[w] || w);
}

/** Levenshtein distance for typo tolerance */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Check if two words are similar within a tolerance */
function isSimilar(word: string, target: string, maxDistance: number = 2): boolean {
  if (word === target) return true;
  if (word.length <= 2 || target.length <= 2) return word === target;
  if (target.includes(word)) return true;
  if (word.includes(target)) return true;
  const dist = levenshtein(word, target);
  const tolerance = Math.max(1, Math.floor(target.length / 4));
  return dist <= tolerance && dist <= maxDistance;
}

/** Score a single query word against the target text */
function scoreWord(queryWord: string, targetWords: string[]): number {
  let bestScore = 0;
  for (const target of targetWords) {
    if (queryWord === target) {
      bestScore = Math.max(bestScore, 100);
    } else if (target.startsWith(queryWord)) {
      bestScore = Math.max(bestScore, 80);
    } else if (queryWord.startsWith(target) && target.length >= 2) {
      bestScore = Math.max(bestScore, 70);
    } else if (target.includes(queryWord)) {
      bestScore = Math.max(bestScore, 60);
    } else if (isSimilar(queryWord, target)) {
      bestScore = Math.max(bestScore, 40);
    }
  }
  return bestScore;
}

export interface SearchResult<T> {
  item: T;
  score: number;
}

/** Fuzzy search with relevance scoring */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getText: (item: T) => string
): SearchResult<T>[] {
  if (!query.trim()) return items.map(item => ({ item, score: 0 }));

  const queryWords = tokenize(query);
  if (queryWords.length === 0) return items.map(item => ({ item, score: 0 }));

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const text = getText(item);
    const targetWords = tokenize(text);

    let totalScore = 0;
    let matchedWords = 0;

    for (const qw of queryWords) {
      const score = scoreWord(qw, targetWords);
      if (score > 0) {
        totalScore += score;
        matchedWords++;
      }
    }

    // Bonus for matching all query words
    if (matchedWords === queryWords.length) {
      totalScore += 25;
    }
    // Bonus for phrase match
    const normalizedQuery = normalize(query);
    const normalizedText = normalize(text);
    if (normalizedText.includes(normalizedQuery)) {
      totalScore += 50;
    }

    if (totalScore > 0) {
      results.push({ item, score: totalScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Search suggestions based on prefix */
export function getSuggestions(
  items: string[],
  prefix: string,
  limit: number = 5
): string[] {
  if (!prefix.trim() || prefix.length < 2) return [];
  const prefixNorm = normalize(prefix);
  return items
    .filter(item => normalize(item).includes(prefixNorm))
    .slice(0, limit);
}
