"""
Data cleaning engine — extracts categories, brands, specs from raw product names.
Pure regex/pattern matching — no AI needed.
"""
import re
from datetime import datetime
from typing import Dict, List, Optional

ALL_BRANDS = [
    'intel', 'amd', 'ryzen', 'core', 'xeon', 'threadripper', 'athlon', 'pentium', 'celeron',
    'nvidia', 'geforce', 'radeon', 'asus', 'msi', 'gigabyte', 'evga', 'sapphire', 'xfx',
    'powercolor', 'zotac', 'palit', 'pny', 'arc',
    'corsair', 'gskill', 'g.skill', 'kingston', 'crucial', 'adata', 'teamgroup', 'patriot',
    'thermaltake', 'lexar', 'fury', 'vengeance', 'trident',
    'samsung', 'wd', 'western digital', 'seagate', 'sandisk',
    'lg', 'benq', 'aoc', 'dell', 'hp', 'lenovo', 'philips', 'viewsonic', 'acer', 'predator',
    'nzxt', 'magma', 'maxipower', 'game revolution', 'xiaomi', 'proart',
    'asrock', 'biostar',
    'be quiet', 'cooler master', 'deepcool', 'phanteks', 'lian li', 'fractal design', 'antec',
    'noctua', 'arctic',
    'logitech', 'razer', 'hyperx', 'steelseries', 'redragon',
]

CATEGORY_PATTERNS = {
    'cpu': [
        (r'\bprocesseur\b|\bcpu\b|\bcore\s+i[3579]\b|\bryzen\s+[3579]\b|\bathlon\b|\bpentium\b|\bceleron\b|\bthreadripper\b|\bxeon\b|\bultra\s+[579]', 10),
        (r'\d+\s*c(?:oeurs?)?[\/\s]\d+\s*t\b', 8),
        (r'\d+\.?\d*\s*ghz.*\d+\s*core', 5),
        (r'\b(socket\s+(?:am[45]|lga\d+)|am[45]\b|lga\d+)', 6),
    ],
    'gpu': [
        (r'\brtc\s*\d{4}\s*(?:ti|super)?\b|\bgtx\s*\d{3,4}\b|\bgt\s*\d{3,4}\b|\brx\s*\d{4}\s*(?:xt|xtx)?\b', 10),
        (r'\bgeforce\b|\bradeon\b|\bcarte\s+graphique\b|\bgraphics\s+card\b', 8),
        (r'\bgddr[56]x?\b|\bvram\b', 7),
    ],
    'ram': [
        (r'\bddr[345]\b|\bram\b|\bm[eé]moire\b|\bmemory\b', 10),
        (r'\bcl\d+\b|\bcas\s+latency\b', 7),
        (r'\bkit\s+\d+x\d+\b|\bdual\s+channel\b', 6),
    ],
    'storage': [
        (r'\bssd\b|\bhdd\b|\bnvme\b|\bm\.2\b|\bhard\s+drive\b|\bdisque\s+dur\b', 10),
        (r'\bsata\s+ssd\b|\bpcie\s+ssd\b', 6),
    ],
    'monitor': [
        (r'\b[eé]cran\b|\bmonitor\b|\b[eé]cran\s+pc\b', 10),
        (r'\b\d+[\"\']?\s*(?:\d+\s*hz|\bhz\b|\bpouces?\b|\binch\b)', 7),
        (r'\b(?:fhd|qhd|uhd|4k|full\s+hd|2k|wqhd)\b.*\d+\s*hz', 5),
        (r'\bips\b|\bva\b|\btn\b|\boled\b|\bmini[-\s]?led\b', 4),
    ],
    'motherboard': [
        (r'\bcarte\s+m[eè]re\b|\bmotherboard\b|\bmainboard\b', 10),
        (r'\b(?:z\d{3}|b\d{3}|x\d{3}|h\d{3})\b', 5),
    ],
    'psu': [
        (r'\balimentation\b|\bpower\s+supply\b|\bpsu\b|\b80\s*plus\b', 10),
    ],
    'case': [
        (r'\bbo[iî]tier\b|\bcase\b|\bchassis\b|\btower\b', 10),
    ],
    'cooling': [
        (r'\bcooler\b|\bventilateur\b|\bfan\b|\bradiator\b|\baio\b|\bwater\s+cooling\b|\bliquid\s+cooler\b', 10),
    ],
    'keyboard': [(r'\bclavier\b|\bkeyboard\b', 10)],
    'mouse': [(r'\bsouris\b|\bmouse\b', 10)],
    'headset': [(r'\bcasque\b|\bheadset\b|\bheadphone\b', 10)],
}

URL_HINTS = {
    'processeur': 'cpu', 'processor': 'cpu', 'cpu': 'cpu',
    'carte-graphique': 'gpu', 'graphics-card': 'gpu', 'gpu': 'gpu',
    'ram': 'ram', 'memoire': 'ram', 'memory': 'ram',
    'carte-mere': 'motherboard', 'motherboard': 'motherboard',
    'disque': 'storage', 'storage': 'storage', 'ssd': 'storage', 'hdd': 'storage',
    'monitor': 'monitor', 'ecran': 'monitor',
    'alimentation': 'psu', 'psu': 'psu', 'power': 'psu',
    'boitier': 'case', 'case': 'case',
    'cooling': 'cooling', 'ventilateur': 'cooling', 'fan': 'cooling',
    'clavier': 'keyboard', 'keyboard': 'keyboard',
    'souris': 'mouse', 'mouse': 'mouse',
    'casque': 'headset', 'headset': 'headset',
}


def extract_cpu_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+)\s*(?:c(?:oeurs?)?|cores?)', name, re.I)
    if m: specs['cores'] = int(m.group(1))
    m = re.search(r'(\d+)\s*(?:threads?)', name, re.I)
    if m: specs['threads'] = int(m.group(1))
    m = re.search(r'(\d+[\.,]?\d*)\s*ghz', name, re.I)
    if m: specs['base_clock'] = m.group(1).replace(',', '.') + ' GHz'
    m = re.search(r'(?:up to|jusqu\'[aà])\s+(\d+[\.,]?\d*)\s*ghz', name, re.I)
    if m: specs['boost_clock'] = m.group(1).replace(',', '.') + ' GHz'
    m = re.search(r'(\d+)\s*(?:mo|mb)\s*(?:cache|smart cache)', name, re.I)
    if m: specs['cache'] = m.group(1) + ' MB'
    socket_map = {'am5': 'AM5', 'socket am5': 'AM5', 'am4': 'AM4', 'socket am4': 'AM4',
                  'lga1700': 'LGA1700', 'lga 1700': 'LGA1700', 'socket 1700': 'LGA1700'}
    lower = name.lower()
    for key, val in socket_map.items():
        if key in lower: specs['socket'] = val; break
    m = re.search(r'(\d+)(?:th|°)\s*gen', name, re.I)
    if m: specs['generation'] = m.group(1) + 'th Gen'
    return specs


def extract_gpu_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+)\s*(?:gb|go)', name, re.I)
    if m: specs['vram'] = m.group(1) + ' GB'
    for pattern in [r'rtx\s*(\d{4})\s*(ti|super)?', r'gtx\s*(\d{3,4})', r'gt\s*(\d{3,4})',
                    r'rx\s*(\d{4})\s*(xt|xtx)?', r'arc\s*a(\d+)']:
        m = re.search(pattern, name, re.I)
        if m: specs['chipset'] = m.group(0).upper(); break
    variants = ['strix', 'tuf', 'gaming x', 'gaming', 'aero', 'ventus', 'suprim', 'eagle', 'windforce', 'dual']
    lower = name.lower()
    for v in variants:
        if v in lower: specs['variant'] = v.title(); break
    return specs


def extract_ram_specs(name: str) -> Dict:
    specs = {}
    lower = name.lower()
    if 'ddr5' in lower: specs['type'] = 'DDR5'
    elif 'ddr4' in lower: specs['type'] = 'DDR4'
    elif 'ddr3' in lower: specs['type'] = 'DDR3'
    m = re.search(r'(\d+)\s*(?:gb|go)', name, re.I)
    if m: specs['capacity'] = m.group(1) + ' GB'
    m = re.search(r'(\d{4,5})\s*(?:mhz|mt/s)', name, re.I)
    if m: specs['speed'] = m.group(1) + ' MHz'
    m = re.search(r'cl(\d+)', name, re.I)
    if m: specs['cas_latency'] = 'CL' + m.group(1)
    m = re.search(r'(\d+)x(\d+)', name, re.I)
    if m: specs['sticks'] = m.group(1); specs['stick_size'] = m.group(2) + ' GB'
    if 'rgb' in lower: specs['rgb'] = 'Yes'
    return specs


def extract_monitor_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+[\.,]?\d*)\s*(?:"|inch|pouces)', name, re.I)
    if m: specs['size'] = m.group(1).replace(',', '.') + '"'
    m = re.search(r'(\d+)\s*hz', name, re.I)
    if m: specs['refresh_rate'] = m.group(1) + ' Hz'
    lower = name.lower()
    if '4k' in lower or 'uhd' in lower: specs['resolution'] = '4K UHD'
    elif '2k' in lower or 'qhd' in lower or 'wqhd' in lower: specs['resolution'] = 'QHD 2K'
    elif 'fhd' in lower or 'full hd' in lower: specs['resolution'] = 'Full HD'
    elif 'hd' in lower: specs['resolution'] = 'HD'
    for panel in ['ips', 'va', 'tn', 'oled', 'qled', 'mini-led']:
        if panel in lower: specs['panel'] = panel.upper(); break
    m = re.search(r'(\d+(?:[\.,]\d+)?)\s*ms', name, re.I)
    if m: specs['response_time'] = m.group(1).replace(',', '.') + 'ms'
    return specs


def extract_storage_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d+)\s*(tb|to|gb|go)', name, re.I)
    if m: specs['capacity'] = m.group(1) + ' ' + m.group(2).upper()
    lower = name.lower()
    if 'nvme' in lower: specs['type'] = 'NVMe SSD'
    elif 'm.2' in lower: specs['type'] = 'M.2 SSD'
    elif 'ssd' in lower: specs['type'] = 'SATA SSD'
    elif 'hdd' in lower: specs['type'] = 'HDD'
    m = re.search(r'(\d{3,4})\s*(?:mo/s|mb/s)', name, re.I)
    if m: specs['read_speed'] = m.group(1) + ' MB/s'
    return specs


def extract_motherboard_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'\b([zbxh]\d{3}[a-z]?)\b', name, re.I)
    if m: specs['chipset'] = m.group(1).upper()
    lower = name.lower()
    if 'ddr5' in lower: specs['memory'] = 'DDR5'
    elif 'ddr4' in lower: specs['memory'] = 'DDR4'
    for s in ['am5', 'am4', 'lga1700']:
        if s in lower: specs['socket'] = s.upper(); break
    for ff in ['eatx', 'atx', 'micro-atx', 'matx', 'mini-itx']:
        if ff in lower: specs['form_factor'] = ff.upper(); break
    if 'wifi' in lower: specs['wifi'] = 'Yes'
    return specs


def extract_psu_specs(name: str) -> Dict:
    specs = {}
    m = re.search(r'(\d{3,4})\s*w', name, re.I)
    if m: specs['wattage'] = m.group(1) + 'W'
    lower = name.lower()
    for cert in ['80 plus titanium', '80 plus platinum', '80 plus gold', '80 plus silver', '80 plus bronze']:
        if cert in lower: specs['efficiency'] = cert.title(); break
    if 'fully modular' in lower: specs['modular'] = 'Full'
    elif 'semi modular' in lower: specs['modular'] = 'Semi'
    return specs


def detect_category(name: str, url: str = '') -> str:
    lower_name = name.lower()
    lower_url = url.lower()
    scores: Dict[str, int] = {}
    for cat, patterns in CATEGORY_PATTERNS.items():
        for pattern, weight in patterns:
            if re.search(pattern, lower_name):
                scores[cat] = scores.get(cat, 0) + weight
    for hint, cat in URL_HINTS.items():
        if hint in lower_url: scores[cat] = scores.get(cat, 0) + 5
    if scores:
        best = max(scores.items(), key=lambda x: x[1])
        if best[1] >= 3: return best[0]
    return 'unknown'


def extract_specs(name: str, category: str) -> Dict:
    extractors = {
        'cpu': extract_cpu_specs, 'gpu': extract_gpu_specs, 'ram': extract_ram_specs,
        'monitor': extract_monitor_specs, 'storage': extract_storage_specs,
        'motherboard': extract_motherboard_specs, 'psu': extract_psu_specs,
    }
    extractor = extractors.get(category)
    return extractor(name) if extractor else {}


def detect_brand(name: str) -> str:
    lower = name.lower()
    for brand in ALL_BRANDS:
        if brand.lower() in lower:
            return brand.title()
    return 'Unknown'


def detect_condition(name: str) -> str:
    lower = name.lower()
    if any(w in lower for w in ['used', 'occasion', 'reconditionné']): return 'Used'
    if any(w in lower for w in ['tray', 'oem', 'bulk', 'mpk']): return 'Tray/OEM'
    return 'New'


def normalize_model_key(name: str, category: str) -> str:
    lower = re.sub(r'[^\w\s\d]', ' ', name.lower())
    if category == 'cpu':
        for p in [r'i[3579]\s*\d{4,5}[a-z]*', r'ryzen\s+[3579]\s*\d{4}[a-z]*']:
            m = re.search(p, lower)
            if m: return m.group(0).replace(' ', '')
    elif category == 'gpu':
        for p in [r'rtx\s*\d{4}\s*(?:ti|super)?', r'rx\s*\d{4}\s*(?:xt|xtx)?', r'gtx\s*\d{3,4}']:
            m = re.search(p, lower)
            if m: return m.group(0).replace(' ', '')
    elif category == 'ram':
        m = re.search(r'\d+\s*gb.*ddr[345].*\d{4}', lower)
        if m: return m.group(0).replace(' ', '')
    elif category == 'monitor':
        s = re.search(r'(\d+)\s*(?:"|inch)', lower)
        h = re.search(r'(\d+)\s*hz', lower)
        if s and h: return f"{s.group(1)}inch{h.group(1)}hz"
    elif category == 'storage':
        m = re.search(r'\d+\s*(?:tb|gb).*\b(?:nvme|ssd|hdd)\b', lower)
        if m: return m.group(0).replace(' ', '')
    return ''.join([w for w in lower.split() if len(w) > 2][:5])


def clean_product(raw: dict) -> Optional[dict]:
    name = raw.get('name', '').strip()
    url = raw.get('url', '')
    if not name: return None

    # Clean HTML entities
    name = (name
        .replace('&amp;', '&').replace('&quot;', '"').replace('&#x27;', "'")
        .replace('&lt;', '<').replace('&gt;', '>').replace('&nbsp;', ' ')
        .replace('  ', ' ')
    )

    category = detect_category(name, url)
    brand = detect_brand(name)
    specs = extract_specs(name, category)
    condition = detect_condition(name)
    model_key = normalize_model_key(name, category)

    def parse_price(p):
        if not p: return None
        cleaned = re.sub(r'[\s\u00A0]', '', str(p))
        cleaned = re.sub(r'DA|DZD|\$|€|£', '', cleaned, flags=re.I).replace(',', '')
        try: return float(cleaned)
        except: return None

    price = parse_price(raw.get('price'))
    old_price = parse_price(raw.get('old_price'))
    if not price: return None

    def fmt_price(p):
        return f"{p:,.0f} DA" if p else ''

    return {
        'name': name,
        'raw_name': raw.get('name', name),
        'price': price,
        'price_formatted': fmt_price(price),
        'old_price': old_price,
        'old_price_formatted': fmt_price(old_price) if old_price else None,
        'availability': raw.get('availability', 'Unknown'),
        'in_stock': not bool(re.search(r'out of stock|rupture|épuisé|indisponible', raw.get('availability', ''), re.I)),
        'url': url,
        'image': raw.get('image', ''),
        'site': raw.get('site', ''),
        'retailer_name': raw.get('retailer_name', raw.get('site', '').replace('.com.dz', '').replace('.com', '').title()),
        'category': category,
        'brand': brand,
        'sku': raw.get('sku') or raw.get('product_id') or f"{raw.get('site', 'unknown')}-{model_key}",
        'model_key': model_key,
        'condition': condition,
        'specs': specs,
        'scraped_at': raw.get('scraped_at', datetime.utcnow().isoformat()),
    }


def clean_all(raw_products: List[dict]) -> List[dict]:
    cleaned = []
    for raw in raw_products:
        try:
            product = clean_product(raw)
            if product and product['name'] and product['price'] > 0:
                cleaned.append(product)
        except Exception as e:
            print(f"[WARN] Clean failed: {e}")
    return cleaned


from datetime import datetime
