"""
Merged Data Cleaning Engine — best of Downloads script + dztechhunt architecture.
Keeps same output format so adapter_v2.py works unchanged.

Improvements over old dztechhunt:
- Advanced name cleaning (noise stripping, 30+ HTML entities)
- Fixed price parsing (handles dot separators like 55.000 DA)
- 40+ brands (was ~25)
- 14 categories (was 12, adds laptop/desktop)
- Enhanced specs: TDP, GPU brand, HDR, sync, curved, PCIe version, form factor, ECC, Bluetooth
- SKU deduplication in clean_all()
- More socket types, more GPU variants, more patterns
"""
import re
from datetime import datetime
from typing import Dict, List, Optional
from name_cleaner import smart_name

# ═══════════════════════════════════════════════════════════
#  EXPANDED BRAND DATABASE (40+ brands)
# ═══════════════════════════════════════════════════════════

ALL_BRANDS = [
    # Processors
    'intel', 'amd', 'ryzen', 'core', 'xeon', 'threadripper', 'athlon', 'pentium', 'celeron', 'ultra',
    # Graphics
    'nvidia', 'geforce', 'radeon', 'arc', 'asrock', 'sapphire', 'xfx', 'powercolor', 'zotac', 'palit', 'pny',
    # Motherboard/GPU OEMs
    'asus', 'msi', 'gigabyte', 'evga', 'biostar', 'colorful', 'galax', 'inno3d', 'gainward',
    # RAM
    'corsair', 'gskill', 'g.skill', 'kingston', 'crucial', 'adata', 'teamgroup', 'patriot', 'thermaltake',
    'lexar', 'fury', 'vengeance', 'trident', 'predator', 'hyperx', 't-force', 'mushkin',
    # Storage
    'samsung', 'wd', 'western digital', 'seagate', 'sandisk', 'intel ssd', 'crucial ssd', 'teamgroup ssd',
    'kingston ssd', 'sabrent', 'corsair ssd',
    # Monitors
    'lg', 'benq', 'aoc', 'dell', 'hp', 'lenovo', 'philips', 'viewsonic', 'acer', 'predator',
    'asus rog', 'msi monitor', 'samsung monitor', 'gigabyte monitor',
    # Cases & Cooling
    'nzxt', 'cooler master', 'deepcool', 'phanteks', 'lian li', 'fractal design', 'antec', 'corsair case',
    'be quiet', 'noctua', 'arctic', 'thermaltake case', 'corsair cooling',
    # PSU
    'corsair psu', 'evga psu', 'seasonic', 'thermaltake psu', 'be quiet psu', 'cooler master psu',
    # Peripherals
    'logitech', 'razer', 'hyperx', 'steelseries', 'redragon', 'corsair peripheral', 'roccat', 'glorious',
    # Algerian/local brands + monitor brands
    'magma', 'maxipower', 'game revolution', 'xiaomi', 'proart', 't-dagger', 'fantech', 'matos', 'neonix',
]


# ═══════════════════════════════════════════════════════════
#  EXPANDED CATEGORY PATTERNS (Weighted Scoring)
# ═══════════════════════════════════════════════════════════

CATEGORY_PATTERNS = {
    'cpu': [
        (r'\bprocesseur\b|\bcpu\b|\bprocesseurs?\b', 10),
        (r'\bcore\s+i[3579]\b|\bryzen\s+[3579]\b|\bathlon\b|\bpentium\b|\bceleron\b', 10),
        (r'\bthreadripper\b|\bxeon\b|\bultra\s+[579]\b', 10),
        (r'\bintel\s+(?:core|pentium|celeron|xeon)\b', 9),
        (r'\bamd\s+(?:ryzen|athlon|threadripper)\b', 9),
        (r'\d+\s*c(?:oeurs?)?[/\s]\d+\s*t\b|\d+\s*coeurs?\b', 8),
        (r'\d+\.?\d*\s*ghz.*\d+\s*(?:core|coeur)', 5),
        (r'\b(socket\s+(?:am[45]|lga\d+)|am[45]\b|lga\d+)\b', 6),
        (r'\b(unlocked|k\b|kf\b|f\b)(?:\s|$|\b)', 4),
    ],
    'gpu': [
        (r'\brtc\s*\d{4}\s*(?:ti|super)?\b|\bgtx\s*\d{3,4}\b|\bgt\s*\d{3,4}\b', 10),
        (r'\brx\s*\d{4}\s*(?:xt|xtx)?\b', 10),
        (r'\bgeforce\s+(?:rtx|gtx|gt)\b|\bradeon\s+rx\b', 9),
        (r'\bcarte\s+graphique\b|\bgraphics\s+card\b|\bvga\b|\bvideo\s+card\b', 8),
        (r'\bgddr[56]x?\b|\bvram\b|\bgo\s+DDR\b', 7),
        (r'\b(asus|msi|gigabyte|evga|zotac|sapphire|xfx|palit|pny)\s+(?:dual|tuf|strix|gaming|eagle|ventus|aero)\b', 6),
        (r'\b\d+\s*(?:gb|go)\s+(?:gddr|ddr|memory)\b.*\b(rtx|gtx|rx)\b', 6),
    ],
    'ram': [
        (r'\bddr[345]\b', 10),
        (r'\bram\b|\bm[eé]moire\s*(?:ram|pc|ddr)?\b|\bmemory\b', 8),
        (r'\bbarrette\s+(?:m[eé]moire|ram)\b|\bkit\s+ram\b', 9),
        (r'\b(corsair|kingston|gskill|g\.skill|crucial|adata|teamgroup)\s+(?:vengeance|fury|trident|predator|value)\b', 7),
        (r'\bcl\d+\b|\bcas\s+latency\b', 7),
        (r'\bkit\s+\d+x\d+\b|\bdual\s+channel\b|\bsingle\s+stick\b', 6),
        (r'\d{4,5}\s*(?:mhz|mt/s)\b', 5),
        (r'\bdimm\b|\bsodimm\b', 5),
    ],
    'storage': [
        (r'\bssd\b|\bnvme\b|\bm\.2\b', 10),
        (r'\bhdd\b|\bhard\s+drive\b|\bdisque\s+dur\b', 9),
        (r'\bsata\s+(?:ssd|iii)\b|\bpcie\s+(?:ssd|gen\d)\b', 6),
        (r'\b(samsung|wd|seagate|crucial|kingston)\s+(?:980|990|sn\d+|firecuda|mx\d+)\b', 7),
        (r'\b\d+\s*(?:tb|gb|to|go)\s+(?:ssd|hdd|nvme|m\.2)\b', 6),
        (r'\b2280\b|\b2260\b|\b2242\b', 4),  # M.2 form factors
    ],
    'monitor': [
        (r'\b[eé]cran\s+(?:pc|gaming|ips|led)\b|\bmonitor\b|\b[eé]cran\b', 10),
        (r'\b\d+[\"\']?\s*(?:\d+\s*hz|\bhz\b|\bpouces?\b|\binch\b|\")', 8),
        (r'\b(?:fhd|qhd|uhd|4k|full\s+hd|2k|wqhd|ultrawide|curved)\b.*\d+\s*hz', 6),
        (r'\b(ips|va|tn|oled|qled|mini[-\s]?led)\b.*\b(\d+\s*hz|\d+[\"\'])', 6),
        (r'\b(?:freesync|gsync|g-sync|adaptive\s+sync)\b', 5),
        (r'\b\d+\s*ms\b.*\b(?:response|gtg)\b', 4),
    ],
    'motherboard': [
        (r'\bcarte\s+m[eè]re\b|\bmotherboard\b|\bmainboard\b', 10),
        (r'\b(?:z\d{3}|b\d{3}|x\d{3}|h\d{3}|a\d{3})\b', 5),
        (r'\b(asus|msi|gigabyte|asrock|biostar)\s+(?:prime|tuf|rog|pro|aorus|gaming)\b', 6),
        (r'\b(socket\s+(?:am[45]|lga\d+)|am[45]|lga\d+)\b', 5),
        (r'\bddr[45]\b.*\bcarte\s+m[eè]re\b|\bcarte\s+m[eè]re\b.*\bddr[45]\b', 6),
    ],
    'psu': [
        (r'\balimentation\b|\bpower\s+supply\b|\bpsu\b', 10),
        (r'\b80\s*plus\s+(?:titanium|platinum|gold|silver|bronze|white)\b', 8),
        (r'\b(?:fully|semi)[-\s]?modular\b', 6),
        (r'\b\d{3,4}\s*w\b', 5),
        (r'\b(corsair|evga|seasonic|thermaltake|be\s+quiet|cooler\s+master)\s+(?:rm|cx|tx|bq|pure|focus)\b', 5),
    ],
    'case': [
        (r'\bbo[iî]tier\s+(?:pc|gaming|micro)\b|\bcase\b|\bchassis\b|\btower\b', 10),
        (r'\b(?:mid[-\s]?tower|full[-\s]?tower|mini[-\s]?itx|micro[-\s]?atx)\b', 7),
        (r'\b(nzxt|corsair|cooler\s+master|phanteks|lian\s+li|fractal|antec|deepcool)\s+(?:h\d+|\d{0}d\d+|mesh|define|p\d+)\b', 6),
        (r'\btempered\s+glass\b|\brgb\s+case\b', 4),
    ],
    'cooling': [
        (r'\bwatercooling\b|\bwater\s+cooler\b|\baio\b|\ball[-\s]in[-\s]one\b', 10),
        (r'\bcooler\b|\bventilateur\b|\bfan\b|\bradiator\b|\bheatsink\b', 8),
        (r'\b\d+\s*mm\s*(?:aio|fan|radiator|cooler)\b', 6),
        (r'\b(corsair|nzxt|cooler\s+master|deepcool|be\s+quiet|noctua|arctic)\s+(?:h\d+|kraken|hyper|dark\s|nh-[du]\d+)\b', 6),
        (r'\bthermal\s+paste\b|\bpâte\s+thermique\b', 4),
    ],
    'keyboard': [
        (r'\bclavier\s+(?:gaming|m[eé]canique|sans\s+fil|m[eê]ca)\b|\bkeyboard\b', 10),
        (r'\bclavier\b', 7),
        (r'\bmechanical\s+keyboard\b|\bkeychron\b|\b(logitech|razer|corsair|redragon|steelseries)\s+(?:k\d+|g\d+|huntsman|apex)\b', 6),
        (r'\b(cherry\s+mx|gateron|kailh)\b', 5),
    ],
    'mouse': [
        (r'\bsouris\s+(?:gaming|sans\s+fil|gamer)\b|\bmouse\b', 10),
        (r'\bsouris\b', 7),
        (r'\b(logitech|razer|glorious|steelseries|hyperx|redragon)\s+(?:g\s*pro|deathadder|model\s*[o]|rival|pulsefire)\b', 6),
        (r'\bdpi\b.*\bmouse\b|\bmouse\b.*\bdpi\b', 4),
    ],
    'headset': [
        (r'\bcasque\s+(?:gaming|sans\s+fil|gamer|micro)\b|\bheadset\b|\bheadphone\b', 10),
        (r'\bcasque\b|\bcasque-micro\b', 7),
        (r'\b(logitech|razer|hyperx|steelseries|corsair)\s+(?:g\d{3}|kraken|cloud|arctis|void)\b', 6),
        (r'\b7\.1\s+surround\b', 4),
    ],
    'laptop': [
        (r'\bpc\s+portable\b|\blaptop\b|\bnotebook\b|\bordinateur\s+portable\b', 10),
        (r'\b(asus|msi|dell|hp|lenovo|acer|apple|macbook)\s+(?:rog|predator|thinkpad|pavilion|omen|nitro|ideapad|victus)\b', 6),
        (r'\b\d+["\']?\s*laptop\b', 5),
    ],
    'desktop': [
        (r'\bpc\s+(?:fixe|bureau|gamer|gaming|complet)\b|\bdesktop\b|\bordinateur\s+de\s+bureau\b', 10),
        (r'\bpc\s+assembl[eé]\b|\bunit[eé]\s+centrale\b', 8),
    ],
}

URL_HINTS = {
    'processeur': 'cpu', 'processor': 'cpu', 'cpu': 'cpu', 'processeurs': 'cpu',
    'carte-graphique': 'gpu', 'graphics-card': 'gpu', 'gpu': 'gpu', 'cartes-graphiques': 'gpu',
    'ram': 'ram', 'memoire': 'ram', 'memory': 'ram', 'barrette': 'ram',
    'carte-mere': 'motherboard', 'motherboard': 'motherboard', 'cartes-meres': 'motherboard',
    'disque': 'storage', 'storage': 'storage', 'ssd': 'storage', 'hdd': 'storage',
    'nvme': 'storage', 'm2': 'storage',
    'monitor': 'monitor', 'ecran': 'monitor', 'moniteur': 'monitor',
    'alimentation': 'psu', 'psu': 'psu', 'power': 'psu',
    'boitier': 'case', 'case': 'case', 'chassis': 'case',
    'cooling': 'cooling', 'ventilateur': 'cooling', 'fan': 'cooling', 'watercooling': 'cooling',
    'clavier': 'keyboard', 'keyboard': 'keyboard',
    'souris': 'mouse', 'mouse': 'mouse',
    'casque': 'headset', 'headset': 'headset', 'casque-micro': 'headset',
    'pc-portable': 'laptop', 'laptop': 'laptop', 'notebook': 'laptop',
    'pc-bureau': 'desktop', 'desktop': 'desktop', 'pc-fixe': 'desktop',
}


# ═══════════════════════════════════════════════════════════
#  ADVANCED SPEC EXTRACTORS (merged from Downloads + dztechhunt)
# ═══════════════════════════════════════════════════════════

def extract_cpu_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+)\s*(?:c(?:oeurs?)?|cores?)', name, re.I)
    if m: specs['cores'] = int(m.group(1))
    m = re.search(r'(\d+)\s*(?:threads?)', name, re.I)
    if m: specs['threads'] = int(m.group(1))
    m = re.search(r'(\d+[.,]?\d*)\s*ghz', name, re.I)
    if m: specs['base_clock'] = m.group(1).replace(',', '.') + ' GHz'
    m = re.search(r'(?:up to|jusqu\'[aà])\s+(\d+[.,]?\d*)\s*ghz', name, re.I)
    if m: specs['boost_clock'] = m.group(1).replace(',', '.') + ' GHz'
    m = re.search(r'(\d+)\s*(?:mo|mb)\s*(?:cache|smart cache)', name, re.I)
    if m: specs['cache'] = m.group(1) + ' MB'

    # More sockets (merged from Downloads)
    socket_map = {
        'am5': 'AM5', 'socket am5': 'AM5',
        'am4': 'AM4', 'socket am4': 'AM4',
        'lga1700': 'LGA1700', 'lga 1700': 'LGA1700', 'socket 1700': 'LGA1700',
        'lga1200': 'LGA1200', 'lga 1200': 'LGA1200',
        'lga1151': 'LGA1151', 'lga 1151': 'LGA1151',
        'lga2066': 'LGA2066', 'lga 2066': 'LGA2066',
        'strx4': 'sTRX4', 'socket strx4': 'sTRX4',
        'wrx8': 'WRX8', 'socket wrx8': 'WRX8',
    }
    lower = name.lower()
    for key, val in socket_map.items():
        if key in lower:
            specs['socket'] = val
            break

    m = re.search(r'(\d+)(?:th|[°\u00B0])\s*gen', name, re.I)
    if m: specs['generation'] = m.group(1) + 'th Gen'

    # TDP (Downloads feature, missing in old dztechhunt)
    m = re.search(r'(\d+)\s*w\b', name, re.I)
    if m and 35 <= int(m.group(1)) <= 300:
        specs['tdp'] = m.group(1) + 'W'

    return specs


def extract_gpu_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+)\s*(?:gb|go)\b', name, re.I)
    if m: specs['vram'] = m.group(1) + ' GB'

    for pattern in [
        r'rtx\s*(\d{4})\s*(ti|super)?',
        r'gtx\s*(\d{3,4})',
        r'gt\s*(\d{3,4})',
        r'rx\s*(\d{4})\s*(xt|xtx)?',
        r'arc\s*a(\d+)',
    ]:
        m = re.search(pattern, name, re.I)
        if m:
            specs['chipset'] = m.group(0).upper()
            break

    # More variants (merged from Downloads)
    variants = ['strix', 'tuf', 'gaming x', 'gaming trio', 'gaming', 'aero',
                'ventus', 'suprim', 'eagle', 'windforce', 'dual', 'founders',
                'ftw3', 'xc', 'gaming oc', 'master']
    lower = name.lower()
    for v in variants:
        if v in lower:
            specs['variant'] = v.title()
            break

    # BRAND DETECTION (Downloads feature, missing in old dztechhunt)
    if 'rtx' in lower or 'gtx' in lower or 'gt ' in lower:
        specs['brand'] = 'NVIDIA'
    elif 'rx ' in lower:
        specs['brand'] = 'AMD'
    elif 'arc' in lower:
        specs['brand'] = 'Intel'

    return specs


def extract_ram_specs(name: str) -> Dict:
    specs = {}
    lower = name.lower()
    if 'ddr5' in lower: specs['type'] = 'DDR5'
    elif 'ddr4' in lower: specs['type'] = 'DDR4'
    elif 'ddr3' in lower: specs['type'] = 'DDR3'

    m = re.search(r'(\d+)\s*(?:gb|go)\b', name, re.I)
    if m: specs['capacity'] = m.group(1) + ' GB'

    m = re.search(r'(\d{4,5})\s*(?:mhz|mt/s)', name, re.I)
    if m: specs['speed'] = m.group(1) + ' MHz'

    m = re.search(r'cl(\d+)', name, re.I)
    if m: specs['cas_latency'] = 'CL' + m.group(1)

    m = re.search(r'(\d+)x(\d+)', name, re.I)
    if m:
        specs['sticks'] = m.group(1)
        specs['stick_size'] = m.group(2) + ' GB'

    if 'rgb' in lower: specs['rgb'] = 'Yes'

    # ECC detection (Downloads feature, missing in old dztechhunt)
    if 'ecc' in lower: specs['ecc'] = 'Yes'

    return specs


def extract_monitor_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+[.,]?\d*)\s*(?:"|inch|pouces)', name, re.I)
    if m: specs['size'] = m.group(1).replace(',', '.') + '"'

    m = re.search(r'(\d+)\s*hz', name, re.I)
    if m: specs['refresh_rate'] = m.group(1) + ' Hz'

    lower = name.lower()
    if '4k' in lower or 'uhd' in lower or '3840' in lower:
        specs['resolution'] = '4K UHD'
    elif '2k' in lower or 'qhd' in lower or 'wqhd' in lower or '2560' in lower:
        specs['resolution'] = 'QHD 2K'
    elif 'fhd' in lower or 'full hd' in lower or '1920' in lower:
        specs['resolution'] = 'Full HD'
    elif 'hd' in lower:
        specs['resolution'] = 'HD'

    for panel in ['ips', 'va', 'tn', 'oled', 'qled', 'mini-led', 'nano-ips']:
        if panel in lower:
            specs['panel'] = panel.upper()
            break

    m = re.search(r'(\d+(?:[.,]\d+)?)\s*ms', name, re.I)
    if m: specs['response_time'] = m.group(1).replace(',', '.') + 'ms'

    # HDR (Downloads feature, missing in old dztechhunt)
    m = re.search(r'hdr\s*(\d+)', name, re.I)
    if m: specs['hdr'] = 'HDR' + m.group(1)

    # Sync (Downloads feature, missing in old dztechhunt)
    if 'freesync' in lower or 'free sync' in lower:
        specs['sync'] = 'FreeSync'
    elif 'gsync' in lower or 'g-sync' in lower:
        specs['sync'] = 'G-Sync'

    # Curved (Downloads feature, missing in old dztechhunt)
    if 'curved' in lower or 'incurvé' in lower:
        specs['curved'] = 'Yes'

    return specs


def extract_storage_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+)\s*(tb|to|gb|go)\b', name, re.I)
    if m: specs['capacity'] = m.group(1) + ' ' + m.group(2).upper()

    lower = name.lower()
    # PCIe version detection (Downloads feature, missing in old dztechhunt)
    if 'nvme' in lower and 'pcie' in lower:
        m2 = re.search(r'pcie\s*(\d+\.?\d*)', name, re.I)
        if m2:
            specs['type'] = f'NVMe PCIe {m2.group(1)}'
        else:
            specs['type'] = 'NVMe SSD'
    elif 'nvme' in lower:
        specs['type'] = 'NVMe SSD'
    elif 'm.2' in lower:
        specs['type'] = 'M.2 SSD'
    elif 'ssd' in lower:
        specs['type'] = 'SATA SSD'
    elif 'hdd' in lower:
        specs['type'] = 'HDD'

    m = re.search(r'(\d{3,4})\s*(?:mo/s|mb/s)', name, re.I)
    if m: specs['read_speed'] = m.group(1) + ' MB/s'

    # Form factor (Downloads feature, missing in old dztechhunt)
    if '2280' in lower: specs['form'] = '2280'
    elif '2242' in lower: specs['form'] = '2242'
    elif '2.5' in lower: specs['form'] = '2.5"'
    elif '3.5' in lower: specs['form'] = '3.5"'

    return specs


def extract_motherboard_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'\b([zbxha]\d{3}[a-z]?)\b', name, re.I)
    if m: specs['chipset'] = m.group(1).upper()

    lower = name.lower()
    if 'ddr5' in lower: specs['memory'] = 'DDR5'
    elif 'ddr4' in lower: specs['memory'] = 'DDR4'

    for s in ['am5', 'am4', 'lga1700', 'lga1200', 'lga1151']:
        if s in lower:
            specs['socket'] = s.upper()
            break

    for ff in ['eatx', 'atx', 'micro-atx', 'matx', 'mini-itx']:
        if ff in lower:
            specs['form_factor'] = ff.upper()
            break

    if 'wifi' in lower or 'wi-fi' in lower: specs['wifi'] = 'Yes'

    # Bluetooth detection (Downloads feature, missing in old dztechhunt)
    if 'bluetooth' in lower: specs['bluetooth'] = 'Yes'

    return specs


def extract_psu_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d{3,4})\s*w', name, re.I)
    if m: specs['wattage'] = m.group(1) + 'W'

    lower = name.lower()
    for cert in ['80 plus titanium', '80 plus platinum', '80 plus gold',
                  '80 plus silver', '80 plus bronze']:
        if cert in lower:
            specs['efficiency'] = cert.title()
            break

    if 'fully modular' in lower: specs['modular'] = 'Full'
    elif 'semi modular' in lower: specs['modular'] = 'Semi'
    # Non-modular detection (Downloads feature, missing in old dztechhunt)
    elif 'non modular' in lower or 'non-modular' in lower:
        specs['modular'] = 'No'

    return specs


# ═══════════════════════════════════════════════════════════
#  ADVANCED CLEANING (merged from Downloads + dztechhunt)
# ═══════════════════════════════════════════════════════════

def clean_name(name: str, category: str = '') -> str:
    """Smart name cleaning — uses the advanced name_cleaner pipeline."""
    return smart_name(name, category)


def clean_price(price_str: str) -> Optional[float]:
    """Extract numeric price from various formats — handles Algerian, French, and decimal."""
    if not price_str:
        return None
    cleaned = re.sub(r'[\s\u00A0\u202F]', '', str(price_str))
    cleaned = re.sub(r'DA|DZD|\$|€|£|din', '', cleaned, flags=re.I)

    # French decimal format: comma as decimal separator (e.g., "96000,00")
    if ',' in cleaned:
        if re.search(r',\d{1,2}$', cleaned):
            # Decimal cents — replace comma with dot for float parsing
            cleaned = cleaned.replace(',', '.')
        else:
            # Thousands separator — remove comma
            cleaned = cleaned.replace(',', '')

    # Handle dot as Algerian thousands separator vs decimal
    # e.g., "55.000" = 55,000 (Algerian) vs "96000.00" = 96000.00 (decimal cents)
    if re.match(r'^\d+\.\d{3}$', cleaned):
        # Three digits after dot — could be Algerian thousands (55.000) or decimal (55.500)
        parts = cleaned.split('.')
        if parts[1] == '000':
            cleaned = cleaned.replace('.', '')
        # else: keep as decimal (e.g., 55.500)
    elif re.match(r'^\d+\.\d{1,2}$', cleaned):
        # Decimal with 1-2 digits (e.g., 96000.00, 96000.0) — keep as is for float parsing
        pass

    try:
        val = float(cleaned)
        # Sanity cap: max 5,000,000 DZD (~$37K USD) for a single PC component
        return val if val > 0 and val < 5000000 else None
    except ValueError:
        return None


# ═══════════════════════════════════════════════════════════
#  DETECTION FUNCTIONS (merged)
# ═══════════════════════════════════════════════════════════

def detect_category(name: str, url: str = '') -> str:
    """Weighted category detection with URL hints."""
    lower_name = name.lower()
    lower_url = url.lower()
    scores: Dict[str, int] = {}

    for cat, patterns in CATEGORY_PATTERNS.items():
        for pattern, weight in patterns:
            if re.search(pattern, lower_name):
                scores[cat] = scores.get(cat, 0) + weight

    for hint, cat in URL_HINTS.items():
        if hint in lower_url:
            scores[cat] = scores.get(cat, 0) + 5

    if scores:
        best = max(scores.items(), key=lambda x: x[1])
        if best[1] >= 3:
            return best[0]
    return 'unknown'


def detect_brand(name: str) -> str:
    lower = name.lower()
    for brand in ALL_BRANDS:
        if brand.lower() in lower:
            words = brand.split()
            return ' '.join(w.capitalize() for w in words)
    return 'Unknown'


def detect_condition(name: str) -> str:
    lower = name.lower()
    if any(w in lower for w in ['used', 'occasion', 'reconditionné', 'reconditionne', 'second hand']):
        return 'Used'
    if any(w in lower for w in ['tray', 'oem', 'bulk', 'mpk', 'boite non incluse']):
        return 'Tray/OEM'
    if any(w in lower for w in ['neuf', 'new', 'boite', 'box']):
        return 'New'
    return 'New'


def normalize_model_key(name: str, category: str) -> str:
    """Generate normalized key for cross-retailer matching."""
    lower = re.sub(r'[^\w\s\d]', ' ', name.lower())

    if category == 'cpu':
        for p in [r'i[3579]\s*\d{4,5}[a-z]*', r'ryzen\s+[3579]\s*\d{4}[a-z]*', r'athlon\s+\w+']:
            m = re.search(p, lower)
            if m:
                return m.group(0).replace(' ', '')
    elif category == 'gpu':
        for p in [r'rtx\s*\d{4}\s*(?:ti|super)?', r'rx\s*\d{4}\s*(?:xt|xtx)?', r'gtx\s*\d{3,4}']:
            m = re.search(p, lower)
            if m:
                return m.group(0).replace(' ', '')
    elif category == 'ram':
        m = re.search(r'\d+\s*gb.*ddr[345].*\d{4}', lower)
        if m:
            return m.group(0).replace(' ', '')
    elif category == 'monitor':
        s = re.search(r'(\d+)\s*(?:"|inch)', lower)
        h = re.search(r'(\d+)\s*hz', lower)
        if s and h:
            return f"{s.group(1)}inch{h.group(1)}hz"
    elif category == 'storage':
        m = re.search(r'\d+\s*(?:tb|gb).*\b(?:nvme|ssd|hdd)\b', lower)
        if m:
            return m.group(0).replace(' ', '')
    elif category == 'motherboard':
        m = re.search(r'([zbxha]\d{3}[a-z]?).*(ddr[45])', lower)
        if m:
            return m.group(0).replace(' ', '')
    elif category == 'psu':
        m = re.search(r'(\d{3,4})\s*w', lower)
        if m:
            return m.group(1) + 'w'
    elif category == 'case':
        m = re.search(r'(nzxt|corsair|cooler|phanteks|lian)\s+([\w\d]+)', lower)
        if m:
            return m.group(0).replace(' ', '')
    elif category == 'laptop':
        m = re.search(r'(asus|msi|dell|hp|lenovo|acer)\s+(?:rog|predator|thinkpad|pavilion|omen|nitro)', lower)
        if m:
            return m.group(0).replace(' ', '')

    return ''.join([w for w in lower.split() if len(w) > 2][:5])


def extract_specs(name: str, category: str) -> Dict:
    extractors = {
        'cpu': extract_cpu_specs, 'gpu': extract_gpu_specs, 'ram': extract_ram_specs,
        'monitor': extract_monitor_specs, 'storage': extract_storage_specs,
        'motherboard': extract_motherboard_specs, 'psu': extract_psu_specs,
    }
    extractor = extractors.get(category)
    return extractor(name) if extractor else {}


# ═══════════════════════════════════════════════════════════
#  FULL PRODUCT CLEANING PIPELINE (same format as before)
# ═══════════════════════════════════════════════════════════

def clean_product(raw: dict) -> Optional[dict]:
    """Full product cleaning pipeline — same output format, better data.
    Flexible input keys: 'name' or 'title', 'image' or 'imageUrl', 'source' or 'site'."""
    # Flexible name input
    raw_name = (raw.get('name') or raw.get('title') or '').strip()
    url = raw.get('url', '')
    if not raw_name:
        return None

    # Use advanced cleaning (merged from Downloads)
    name = clean_name(raw_name)
    if not name or len(name) < 3:
        return None

    category = detect_category(name, url)
    brand = detect_brand(name)
    specs = extract_specs(name, category)
    condition = detect_condition(name)
    model_key = normalize_model_key(name, category)

    # FIXED price parsing (handles dot separators)
    price = clean_price(raw.get('price'))
    old_price = clean_price(raw.get('old_price'))
    if not price:
        return None

    def fmt_price(p):
        return f"{p:,.0f} DA" if p else ''

    # Flexible site input
    site = raw.get('site') or raw.get('source') or 'unknown'

    # Build SKU with price suffix (from Downloads — prevents stale duplicates)
    sku = raw.get('sku') or raw.get('product_id')
    if not sku:
        sku = f"{site}-{model_key}-{int(price)}"

    return {
        'name': name,
        'raw_name': raw_name,
        'price': price,
        'price_formatted': fmt_price(price),
        'old_price': old_price,
        'old_price_formatted': fmt_price(old_price) if old_price else None,
        'availability': raw.get('availability', 'Unknown'),
        'in_stock': not bool(re.search(r'out of stock|rupture|épuisé|indisponible|non disponible',
                                        raw.get('availability', ''), re.I)),
        'url': url,
        'image': raw.get('image') or raw.get('imageUrl') or '',
        'site': site,
        'retailer_name': raw.get('retailer_name', site.replace('.com.dz', '').replace('.com', '').title()),
        'category': category,
        'brand': brand,
        'sku': sku,
        'model_key': model_key,
        'condition': condition,
        'specs': specs,
        'scraped_at': raw.get('scraped_at', datetime.utcnow().isoformat()),
    }


def clean_all(raw_products: List[dict]) -> List[dict]:
    """Clean a batch of raw products with SKU deduplication."""
    cleaned = []
    seen_skus = set()
    for raw in raw_products:
        try:
            product = clean_product(raw)
            if product and product['name'] and product['price'] and product['price'] > 0:
                # Deduplicate by SKU (merged from Downloads)
                if product['sku'] not in seen_skus:
                    seen_skus.add(product['sku'])
                    cleaned.append(product)
        except Exception as e:
            print(f"[WARN] Clean failed: {e}")
    return cleaned
