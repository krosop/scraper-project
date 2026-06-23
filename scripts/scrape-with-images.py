#!/usr/bin/env python3
"""
Scraper with image extraction — gets REAL product images from Algerian stores
Uses WooCommerce REST API + PhantomJS Cloud for CF-protected sites
"""

import sys, json, re, time
sys.path.insert(0, '.')

from curl_cffi import requests as curl
from bs4 import BeautifulSoup
import cloudscraper

cf_scraper = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False},
    delay=8
)
API_KEY = 'ak-yxxpt-n76bv-q6gxv-857z2-vbc2c'

def parse_price(text):
    if not text: return None
    c = str(text).lower().replace('\n',' ').replace('\t',' ').replace('\xa0',' ')
    c = c.replace('د.ج','').replace('dzd','').replace('da','').replace('dinar','').replace(',','').strip()
    m = re.search(r'(\d{1,3}(?:\s+\d{3})+)', c)
    if m: return int(m.group(1).replace(' ',''))
    m = re.search(r'(\d{3,})', c)
    if m: return int(m.group(1))
    return None

def infer_cat(title):
    t = title.lower()
    if any(k in t for k in ['rtx','gtx','radeon','rx ','carte graphique','geforce','gpu']): return 'pc_part'
    if any(k in t for k in ['processeur','ryzen','core i','intel','core ultra','cpu']): return 'pc_part'
    if any(k in t for k in ['ecran','monitor','moniteur','display','oled','écran']): return 'monitor'
    if any(k in t for k in ['carte mere','carte mère','motherboard']): return 'pc_part'
    if any(k in t for k in ['alimentation','boitier','case ','psu','w ','watt']): return 'pc_part'
    if any(k in t for k in ['ram ','ddr','mémoire']): return 'pc_part'
    if any(k in t for k in ['ssd','nvme','m.2','disque dur','hdd']): return 'pc_part'
    if any(k in t for k in ['unite gaming','pc gamer','unité gaming']): return 'pc_part'
    if any(k in t for k in ['laptop','notebook','pc portable']): return 'laptop'
    if any(k in t for k in ['watercooling','pate thermique','pâte thermique','refroidisseur','ventilateur']): return 'pc_part'
    if any(k in t for k in ['souris','clavier','casque','headset','tapis','support','hub usb','webcam']): return 'accessory'
    if any(k in t for k in ['cable','câble','adaptateur','convertisseur']): return 'accessory'
    return 'pc_part'

def phantom_fetch(url):
    try:
        payload = {
            'url': url,
            'renderType': 'html',
            'requestSettings': {
                'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'waitInterval': 12000
            }
        }
        r = curl.post(f'https://phantomjscloud.com/api/browser/v2/{API_KEY}/', json=payload, timeout=90)
        if r.status_code == 200 and len(r.text) > 5000:
            return r.text
    except Exception as e:
        print(f"  [PhantomJS Error] {e}", file=sys.stderr)
    return None

def curl_fetch(url):
    try:
        r = curl.get(url, impersonate='chrome120', timeout=25)
        if r.status_code == 200 and len(r.text) > 3000:
            return r.text
    except: pass
    try:
        r = cf_scraper.get(url, timeout=25)
        if r.status_code == 200 and len(r.text) > 3000:
            return r.text
    except: pass
    return None

def extract_woocommerce_products(html, source_name, base_url):
    """Extract products from WooCommerce HTML with images"""
    soup = BeautifulSoup(html, 'lxml')
    items = []

    for product in soup.select('.product.type-product'):
        # Title
        title_el = product.select_one('.woocommerce-loop-product__title, h2.woocommerce-loop-product__title')
        if not title_el:
            link_el = product.select_one('a.woocommerce-LoopProduct-link')
            if link_el:
                title_el = link_el.select_one('.woocommerce-loop-product__title') or link_el
        title = ''
        if title_el:
            # Remove any nested img tags from title element
            for img in title_el.find_all('img'):
                img.decompose()
            title = title_el.get_text(strip=True)

        # Clean title - remove HTML remnants
        title = re.sub(r'<[^>]+>', '', title).strip()
        title = re.sub(r'https?://\S+', '', title).strip()
        title = re.sub(r'\s+', ' ', title).strip()

        # Price
        price_el = product.select_one('.price bdi, .price .woocommerce-Price-amount, .price ins .woocommerce-Price-amount, .price')
        price = parse_price(price_el.get_text(strip=True)) if price_el else None

        # Product URL
        link_el = product.select_one('a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link')
        url = link_el.get('href', '') if link_el else ''

        # IMAGE - try multiple selectors
        img_url = None
        img_el = product.select_one('img.attachment-woocommerce_thumbnail, img.wp-post-image, img.woocommerce-placeholder, img')
        if img_el:
            # Try data-src (lazy loading) first, then src
            img_url = img_el.get('data-src') or img_el.get('data-lazy-src') or img_el.get('src', '')
            # Clean WordPress image sizing
            if img_url:
                img_url = re.sub(r'-\d+x\d+(\.[a-z]+)$', r'\1', img_url)
                # Fix relative URLs
                if img_url.startswith('/'):
                    img_url = base_url.rstrip('/') + img_url

        if title and len(title) > 3 and price and price > 1000:
            cat = infer_cat(title)
            items.append({
                'source': source_name,
                'title': title[:150],
                'price': price,
                'url': url,
                'imageUrl': img_url,
                'category': cat,
                'location': 'Algeria',
                'condition': 'new'
            })

    return items

def scrape_digitec():
    """Scrape DigiTec DZ via PhantomJS"""
    print("[DigiTec DZ] Fetching via PhantomJS...", file=sys.stderr)
    html = phantom_fetch('https://digitecdz.com/shop/')
    if not html:
        html = phantom_fetch('https://digitecdz.com/')
    if html:
        items = extract_woocommerce_products(html, 'DigiTec DZ', 'https://digitecdz.com')
        print(f"[DigiTec DZ] {len(items)} products", file=sys.stderr)
        return items
    print("[DigiTec DZ] Failed", file=sys.stderr)
    return []

def scrape_chbstore():
    """Scrape CHB-Store"""
    print("[CHB-Store] Fetching...", file=sys.stderr)
    all_items = []
    for page in range(1, 4):
        url = f'https://chb-store.com/boutique/page/{page}/' if page > 1 else 'https://chb-store.com/boutique/'
        html = curl_fetch(url)
        if not html:
            html = phantom_fetch(url)
        if html:
            items = extract_woocommerce_products(html, 'CHB-Store', 'https://chb-store.com')
            all_items.extend(items)
            if len(items) < 5:
                break
        time.sleep(1)
    print(f"[CHB-Store] {len(all_items)} products", file=sys.stderr)
    return all_items

def scrape_africapap():
    """Scrape Africapap"""
    print("[Africapap] Fetching...", file=sys.stderr)
    all_items = []
    for page in range(1, 4):
        url = f'https://africapap.com/shop/page/{page}/' if page > 1 else 'https://africapap.com/shop/'
        html = curl_fetch(url)
        if not html:
            html = phantom_fetch(url)
        if html:
            items = extract_woocommerce_products(html, 'Africapap', 'https://africapap.com')
            all_items.extend(items)
            if len(items) < 5:
                break
        time.sleep(1)
    print(f"[Africapap] {len(all_items)} products", file=sys.stderr)
    return all_items

def scrape_capmicro():
    """Scrape CapMicro Dz"""
    print("[CapMicro Dz] Fetching...", file=sys.stderr)
    all_items = []
    for page in range(1, 4):
        url = f'https://capmicrodz.com/page/{page}/' if page > 1 else 'https://capmicrodz.com/shop/'
        html = curl_fetch(url)
        if not html:
            html = phantom_fetch(url)
        if html:
            items = extract_woocommerce_products(html, 'CapMicro Dz', 'https://capmicrodz.com')
            all_items.extend(items)
            if len(items) < 5:
                break
        time.sleep(1)
    print(f"[CapMicro Dz] {len(all_items)} products", file=sys.stderr)
    return all_items

def scrape_deskcom():
    """Scrape DeskCom IT & Gaming"""
    print("[DeskCom] Fetching...", file=sys.stderr)
    all_items = []
    for page in range(1, 4):
        url = f'https://deskcom-dz.com/boutique/page/{page}/' if page > 1 else 'https://deskcom-dz.com/boutique/'
        html = curl_fetch(url)
        if not html:
            html = phantom_fetch(url)
        if html:
            items = extract_woocommerce_products(html, 'DeskCom IT & Gaming', 'https://deskcom-dz.com')
            all_items.extend(items)
            if len(items) < 5:
                break
        time.sleep(1)
    print(f"[DeskCom] {len(all_items)} products", file=sys.stderr)
    return all_items

def scrape_ami_dz():
    """Scrape AMI-DZ"""
    print("[AMI-DZ] Fetching...", file=sys.stderr)
    all_items = []
    for page in range(1, 4):
        url = f'https://ami-dz.com/page/{page}/' if page > 1 else 'https://ami-dz.com/shop/'
        html = curl_fetch(url)
        if not html:
            html = phantom_fetch(url)
        if html:
            items = extract_woocommerce_products(html, 'AMI-DZ', 'https://ami-dz.com')
            all_items.extend(items)
            if len(items) < 5:
                break
        time.sleep(1)
    print(f"[AMI-DZ] {len(all_items)} products", file=sys.stderr)
    return all_items

def main():
    all_items = []

    # Scrape all stores
    all_items.extend(scrape_digitec())
    all_items.extend(scrape_chbstore())
    all_items.extend(scrape_africapap())
    all_items.extend(scrape_capmicro())
    all_items.extend(scrape_deskcom())
    all_items.extend(scrape_ami_dz())

    # Deduplicate by URL
    seen_urls = set()
    unique_items = []
    for item in all_items:
        if item['url'] and item['url'] not in seen_urls:
            seen_urls.add(item['url'])
            unique_items.append(item)

    print(f"\n[TOTAL] {len(unique_items)} unique products with images", file=sys.stderr)

    # Count items with images
    with_images = sum(1 for i in unique_items if i.get('imageUrl'))
    print(f"[IMAGES] {with_images} products have images", file=sys.stderr)

    # Group by normalized title for multi-store listings
    result = {
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'total': len(unique_items),
        'products': unique_items
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
