"""Smart Name Cleaner — Transforms raw scraped names into clean, structured product names.

Input:  "NewGPU CARTE GRAPHIQUE ASUS DUAL GEFORCE RTX 5060 OC EDITION 8GB"
Output: "ASUS Dual GeForce RTX 5060 OC 8GB"

Input:  "In stockGPU CARTE GRAPHIQUE ZOTAC GEFORCE RTX 5060 Ti 16GB TWIN EDGE"
Output: "Zotac GeForce RTX 5060 Ti 16GB Twin Edge"
"""
import re
from typing import Optional, List

# GARBAGE PREFIXES TO STRIP
GARBAGE_PREFIXES = [
    # Availability
    r'^new\b', r'^in\s+stock\b', r'^out\s+of\s+stock\b', r'^oos\b',
    r'^disponible\b', r'^rupture\b', r'^épuisé\b', r'^indisponible\b',
    r'^available\b', r'^unavailable\b', r'^sold\s+out\b', r'^pre[-\s]?order\b',
    r'^coming\s+soon\b', r'^promo\b', r'^solde\b', r'^promotion\b',
    r'^hot\b', r'^bestseller\b', r'^top\b', r'^featured\b',
    # Category labels that leak
    r'^gpu\b', r'^cpu\b', r'^ram\b', r'^ssd\b', r'^hdd\b', r'^psu\b',
    r'^pc\b', r'^monitor\b', r'^screen\b', r'^vga\b',
    # Generic noise
    r'^produit\b', r'^article\b', r'^item\b', r'^ref\b', r'^réf\b',
]

REDUNDANT_PREFIXES = [
    'carte graphique', 'processeur', 'processeurs', 'ecran pc', 'ecran',
    'barrette memoire', 'barrettes memoire', 'memoire ram', 'alimentation pc',
    'boitier pc', 'boitier', 'carte mere', 'disque dur', 'disque',
    'clavier gaming', 'clavier', 'souris gaming', 'souris',
    'casque gaming', 'casque', 'watercooling', 'ventilateur',
    'pc portable', 'pc gamer', 'pc gaming', 'pc fixe', 'unite centrale',
    'unité centrale', 'ordinateur portable', 'ordinateur de bureau',
]

NOISE_WORDS = [
    'edition', 'édition', 'series', 'série', 'serie', 'original', 'authentique',
    'genuine', 'officiel', 'official', 'marque', 'brand', 'new', 'neuf',
    'boite', 'box', 'sealed', 'scellé', 'scelle', 'warranty', 'garantie',
    'livraison gratuite', 'gratuit', 'free shipping', 'en stock', ' disponible ',
]

BRAND_CAPS = {
    'asus': 'ASUS', 'msi': 'MSI', 'nvidia': 'NVIDIA', 'amd': 'AMD',
    'intel': 'Intel', 'hp': 'HP', 'lg': 'LG', 'aoc': 'AOC', 'wd': 'WD',
    'evga': 'EVGA', 'nzxt': 'NZXT', 'xfx': 'XFX', 'pny': 'PNY',
    'gigabyte': 'Gigabyte', 'sapphire': 'Sapphire', 'zotac': 'Zotac',
    'palit': 'Palit', 'corsair': 'Corsair', 'kingston': 'Kingston',
    'crucial': 'Crucial', 'adata': 'ADATA', 'samsung': 'Samsung',
    'seagate': 'Seagate', 'sandisk': 'SanDisk', 'benq': 'BenQ',
    'dell': 'Dell', 'lenovo': 'Lenovo', 'philips': 'Philips',
    'viewsonic': 'ViewSonic', 'acer': 'Acer', 'logitech': 'Logitech',
    'razer': 'Razer', 'hyperx': 'HyperX', 'steelseries': 'SteelSeries',
    'redragon': 'Redragon', 'noctua': 'Noctua', 'arctic': 'Arctic',
    'cooler master': 'Cooler Master', 'deepcool': 'DeepCool',
    'phanteks': 'Phanteks', 'lian li': 'Lian Li', 'fractal design': 'Fractal Design',
    'antec': 'Antec', 'be quiet': 'be quiet!', 'seasonic': 'Seasonic',
    'thermaltake': 'Thermaltake', 'roccat': 'ROCCAT', 'glorious': 'Glorious',
    'gskill': 'G.Skill', 'g.skill': 'G.Skill', 'teamgroup': 'TeamGroup',
    'patriot': 'Patriot', 'lexar': 'Lexar', 'biostar': 'Biostar',
    'asrock': 'ASRock', 'powercolor': 'PowerColor', 'gainward': 'Gainward',
    'inno3d': 'Inno3D', 'galax': 'Galax', 'colorful': 'Colorful',
    'magma': 'Magma', 'maxipower': 'Maxipower', 'xiaomi': 'Xiaomi',
    'proart': 'ProArt', 't-dagger': 'T-Dagger', 'fantech': 'Fantech',
    'ryzen': 'Ryzen', 'athlon': 'Athlon', 'pentium': 'Pentium',
    'celeron': 'Celeron', 'xeon': 'Xeon', 'threadripper': 'Threadripper',
    'geforce': 'GeForce', 'radeon': 'Radeon',
}

LINE_CAPS = {
    'rog': 'ROG', 'tuf': 'TUF', 'prime': 'Prime', 'proart': 'ProArt',
    'strix': 'Strix', 'dual': 'Dual', 'aero': 'Aero', 'ventus': 'Ventus',
    'suprim': 'Suprim', 'eagle': 'Eagle', 'windforce': 'WindForce',
    'gaming x': 'Gaming X', 'gaming trio': 'Gaming Trio', 'gaming': 'Gaming',
    'founders': 'Founders', 'ftw3': 'FTW3', 'xc': 'XC', 'gaming oc': 'Gaming OC',
    'master': 'Master', 'phantom': 'Phantom', 'hellhound': 'Hellhound',
    'nitro': 'Nitro', 'pulse': 'Pulse', 'challenger': 'Challenger',
    'vengeance': 'Vengeance', 'fury': 'Fury', 'trident': 'Trident',
    'predator': 'Predator', 'beast': 'Beast', 'renegade': 'Renegade',
    'focus': 'Focus', 'rm': 'RM', 'cx': 'CX', 'tx': 'TX', 'bq': 'BQ',
    'pure': 'Pure', 'dark': 'Dark', 'h7': 'H7', 'h5': 'H5', 'h9': 'H9',
    'flow': 'Flow', 'elite': 'Elite', 'mesh': 'Mesh', 'define': 'Define',
    'phantom gaming': 'Phantom Gaming', 'aorus': 'AORUS', 'titanium': 'Titanium',
    'platinum': 'Platinum', 'gold': 'Gold', 'silver': 'Silver', 'bronze': 'Bronze',
}


def strip_garbage_prefixes(name: str) -> str:
    """Remove garbage prefixes like 'NewGPU', 'In stockCPU', etc."""
    concat_patterns = [
        r'^(?:new|hot|bestseller|featured|promo|top)(gpu|cpu|ram|ssd|hdd|psu|pc)\s*',
        r'^(?:in\s+stock|out\s+of\s+stock|disponible|rupture|épuisé)(gpu|cpu|ram|ssd|hdd|psu|pc)\s*',
        r'^(?:new|in\s+stock|disponible|promo)\s+(gpu|cpu|ram|ssd|hdd|psu)\s*',
    ]
    for p in concat_patterns:
        name = re.sub(p, '', name, flags=re.I)
    for p in GARBAGE_PREFIXES:
        name = re.sub(p, '', name, flags=re.I)
    return name.strip()


def strip_redundant_prefix(name: str, category: str = '') -> str:
    """Remove category prefixes like 'CARTE GRAPHIQUE', 'PROCESSEUR'."""
    lower = name.lower()
    for prefix in REDUNDANT_PREFIXES:
        if lower.startswith(prefix):
            name = name[len(prefix):].strip()
            lower = name.lower()
            break
    name = re.sub(r'^(gpu|cpu|ram|ssd|hdd|psu)\s+', '', name, flags=re.I)
    return name.strip()


def strip_noise_words(name: str) -> str:
    """Remove noise words that add no value."""
    for word in NOISE_WORDS:
        pattern = r'\b' + re.escape(word) + r'\b'
        name = re.sub(pattern, '', name, flags=re.I)
    return re.sub(r'\s+', ' ', name).strip()


def remove_duplicate_words(name: str) -> str:
    """Remove consecutive duplicate words."""
    words = name.split()
    result = []
    prev = None
    for w in words:
        if w.lower() != prev:
            result.append(w)
            prev = w.lower()
    return ' '.join(result)


def capitalize_smart(name: str) -> str:
    """Smart capitalization — proper brands/products, lowercase small words."""
    words = name.split()
    result = []
    small_words = {'de', 'du', 'la', 'le', 'les', 'des', 'et', 'en', 'à', 'a',
                   'pour', 'avec', 'sur', 'dans', 'par', 'au', 'aux', 'un', 'une'}
    ALWAYS_UPPER = {
        'rtx', 'gtx', 'gt', 'rx', 'arc',
        'ddr5', 'ddr4', 'ddr3', 'gddr5', 'gddr6', 'gddr6x',
        'rgb', 'argb',
        'oc', 'super', 'xt', 'xtx',
        'cl',
        'ips', 'va', 'tn', 'oled', 'qled',
        'fhd', 'qhd', 'uhd', 'hdr', 'hd',
        'ssd', 'hdd', 'nvme',
        'psu',
        'usb', 'hdmi', 'dp', 'vga', 'dvi',
        'pc', 'ai',
        'dlss', 'fsr',
        'wi-fi', 'wifi', 'bluetooth',
        'coeurs', 'co', 'threads', 't', 'cache', 'gen',
    }
    SPECIAL_UNIT = {
        'hz': 'Hz', 'mhz': 'MHz', 'ghz': 'GHz',
        'mo': 'MO', 'go': 'GO', 'ko': 'KO',
    }
    SPECIAL_CASE = {
        'i3': 'i3', 'i5': 'i5', 'i7': 'i7', 'i9': 'i9',
        'r3': 'R3', 'r5': 'R5', 'r7': 'R7', 'r9': 'R9',
        'ti': 'Ti',
    }
    for i, word in enumerate(words):
        lower = word.lower().rstrip('s')
        word_lower = word.lower()
        if word_lower in BRAND_CAPS:
            result.append(BRAND_CAPS[word_lower])
            continue
        if word_lower in LINE_CAPS:
            result.append(LINE_CAPS[word_lower])
            continue
        if '.' in word_lower:
            for key, val in BRAND_CAPS.items():
                if word_lower == key.lower():
                    result.append(val)
                    break
            else:
                result.append(word.upper() if len(word) <= 3 else word.capitalize())
            continue
        if word_lower in ALWAYS_UPPER:
            result.append(word.upper())
            continue
        if word_lower in SPECIAL_UNIT:
            result.append(SPECIAL_UNIT[word_lower])
            continue
        if word_lower in SPECIAL_CASE:
            result.append(SPECIAL_CASE[word_lower])
            continue
        m = re.match(r'^(\d+\.?\d*)(gb|tb|mb|w|mm|hz|mhz|ghz|"|go|mo)$', word_lower)
        if m:
            num = m.group(1)
            unit = m.group(2)
            if unit in SPECIAL_UNIT:
                result.append(num + SPECIAL_UNIT[unit])
            else:
                result.append(num + unit.upper())
            continue
        m = re.match(r'^(i[3579])-(\d+)([a-z]+)$', word_lower)
        if m:
            result.append(m.group(1) + '-' + m.group(2) + m.group(3).upper())
            continue
        m = re.match(r'^([ir]?)(\d+)([a-z]\d?[a-z]?)$', word_lower)
        if m:
            prefix, num, suffix = m.group(1), m.group(2), m.group(3)
            if prefix == 'i' and len(num) >= 2:
                result.append(prefix + num)
                continue
            if len(num) >= 4 and suffix in {'k', 'kf', 'f', 'x', 'x3d', 'g', 'ge', 'gt'}:
                result.append(num + suffix.upper())
                continue
        if word_lower in {'k', 'kf', 'f', 'x', 'x3d', 'g', 'ge'}:
            result.append(word.upper())
            continue
        m = re.match(r'^([a-z]+\d+[a-z]*\d*)$', word_lower)
        if m and len(word) >= 4 and word_lower not in {'gaming', 'ventus', 'aero', 'eagle'}:
            if re.search(r'\d', word) and not re.search(r'[aeiou]', word_lower):
                result.append(word.upper())
                continue
        if i == 0:
            result.append(word.capitalize())
            continue
        if word_lower in small_words and i > 0:
            result.append(word_lower)
            continue
        result.append(word.capitalize())
    return ' '.join(result)


def smart_name(name: str, category: str = '') -> str:
    """Transform a raw scraped name into a clean, smart product name."""
    if not name:
        return ''
    name = (name
        .replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'")
        .replace('&#x27;', "'").replace('&#39;', "'").replace('&nbsp;', ' ')
        .replace('&lt;', '<').replace('&gt;', '>').replace('&rsquo;', "'")
        .replace('&lsquo;', "'").replace('&rdquo;', '"').replace('&ldquo;', '"')
        .replace('&mdash;', '-').replace('&ndash;', '-').replace('&hellip;', '...')
    )
    name = strip_garbage_prefixes(name)
    name = strip_redundant_prefix(name, category)
    name = strip_noise_words(name)
    name = remove_duplicate_words(name)
    name = re.sub(r'\s+', ' ', name).strip()
    name = re.sub(r'\s*-\s*', '-', name)
    name = re.sub(r'\s*/\s*', '/', name)
    name = name.strip(' -_/|,')
    name = capitalize_smart(name)
    return name
