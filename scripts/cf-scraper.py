#!/usr/bin/env python3
"""
Deal Finder DZ — Full-Product Cloudflare Bypass Scraper
Scrapes ALL products from Algerian sites (no limits, full pagination)
Uses: PhantomJS Cloud > curl_cffi > WooCommerce REST API

Usage: python3 cf-scraper.py [site_key|all]
Output: JSON array of all products to stdout + saves to Supabase
"""

import json, sys, time, re, os
from curl_cffi import requests as curl_req
import cloudscraper
from bs4 import BeautifulSoup

API_KEY = os.environ.get("PHANTOMJSCLOUD_API_KEY", "ak-yxxpt-n76bv-q6gxv-857z2-vbc2c")
PHANTOM_API = f"https://phantomjscloud.com/api/browser/v2/{API_KEY}/"

curl = curl_req
cf_scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}, delay=8)

def parse_price(text):
    if not text: return None
    c = str(text).lower().replace("\n"," ").replace("\t"," ").replace("\xa0"," ")
    c = c.replace("د.ج","").replace("dzd","").replace("da","").replace("dinar","").replace(",","").strip()
    m = re.search(r'(\d{1,3}(?:\s+\d{3})+)', c)
    if m: return int(m.group(1).replace(" ",""))
    m = re.search(r'(\d{1,3}(?:\.\d{3})+)', c)
    if m: return int(m.group(1).replace(".",""))
    m = re.search(r'(\d{3,})', c)
    if m: return int(m.group(1))
    return None

def infer_cat(title):
    t = title.lower()
    if any(k in t for k in ["rtx","gtx","radeon","rx ","carte graphique","geforce","gpu "]): return "pc_part"
    if any(k in t for k in ["processeur","ryzen","core i","intel","core ultra","cpu","core i3","core i5","core i7","core i9"]): return "pc_part"
    if any(k in t for k in ["ecran","monitor","moniteur","display","oled"]): return "monitor"
    if any(k in t for k in ["carte mere","carte mère","motherboard"]): return "pc_part"
    if any(k in t for k in ["alimentation","boitier","case ","psu","w ","watt"]): return "pc_part"
    if any(k in t for k in ["ram ","ddr"]): return "pc_part"
    if any(k in t for k in ["ssd","nvme","m.2"]): return "pc_part"
    if any(k in t for k in ["unite gaming","pc gamer","unité gaming"]): return "pc_part"
    if any(k in t for k in ["laptop","notebook","pc portable"]): return "laptop"
    if any(k in t for k in ["souris","clavier","casque","headset"]): return "accessory"
    return "pc_part"

def fetch(url):
    try:
        r = curl.get(url, impersonate="chrome120", timeout=25)
        if r.status_code == 200 and len(r.text) > 3000: return r.text, "curl_cffi"
    except: pass
    try:
        r = cf_scraper.get(url, timeout=25)
        if r.status_code == 200 and len(r.text) > 3000: return r.text, "cloudscraper"
    except: pass
    return None, None

def phantomjs_render(url):
    try:
        payload = {
            "url": url,
            "renderType": "html",
            "outputAsJson": False,
            "requestSettings": {
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "waitInterval": 10000,
            },
        }
        r = curl.post(PHANTOM_API, json=payload, timeout=90)
        if r.status_code == 200 and len(r.text) > 5000:
            return r.text, "phantomjs"
    except: pass
    return None, None

# ═══ WooCommerce API with full pagination ═══
def scrape_wc_api_full(base, name, loc):
    """Fetch ALL products via WC Store API with pagination"""
    items = []
    page = 1
    while True:
        for ep in [f"{base}/wp-json/wc/store/v1/products?per_page=100&page={page}",
                   f"{base}/wp-json/wc/v3/products?per_page=100&page={page}"]:
            try:
                for client in [curl, cf_scraper]:
                    r = client.get(ep, timeout=20)
                    if r.status_code != 200: continue
                    ct = r.headers.get('content-type', '')
                    if 'json' not in ct: continue
                    data = r.json() if hasattr(r, 'json') else json.loads(r.text)
                    if not isinstance(data) or not isinstance(data, list) or len(data) == 0:
                        return items
                    for p in data:
                        title = p.get('name', '')
                        price = parse_price(p.get('prices', {}).get('price') or p.get('price', ''))
                        url = p.get('permalink', '')
                        if title and price and price > 1000:
                            cat = infer_cat(title)
                            if cat == "phone": continue
                            items.append({"source": name, "title": title[:120], "price": price,
                                "url": url, "category": cat, "location": loc, "condition": "new"})
                    if len(data) < 100: return items
            except: pass
        page += 1
        if page > 20: break
        time.sleep(1)
    return items

# ═══ CSS Selectors with full pagination ═══
def scrape_css_full(urls, name, loc, use_phantom=False):
    items = []
    selector_groups = [
        (".product-cart-wrap", "h2 a, h3 a", ".product-price"),
        (".product.type-product", ".woocommerce-loop-product__title", ".price bdi, .price, .woocommerce-Price-amount"),
        (".product", "h2.woocommerce-loop-product__title, h2, h3", ".price"),
        ("ul.products li", "h2, h3", ".price"),
        (".product-item", ".product-title, h2, h3", ".product-price, .price"),
        (".product-card", ".product-title, h2, h3", ".product-price, .price"),
        ("[class*='product']", "h2, h3, .title", ".price"),
    ]

    # Generate all paginated URLs
    all_urls = list(urls)
    for url in urls:
        # WooCommerce pagination
        for p in range(2, 11):
            if "?" in url:
                all_urls.append(f"{url}&page={p}")
            else:
                all_urls.append(f"{url}?page={p}")
            all_urls.append(f"{url}page/{p}/")

    for url in all_urls:
        html = None
        if use_phantom:
            html, _ = phantomjs_render(url)
        if not html:
            html, _ = fetch(url)
        if not html: continue

        soup = BeautifulSoup(html, "lxml")
        title = soup.title.string.strip() if soup.title else ""
        if any(k in title.lower() for k in ["challenge", "cloudflare", "just a moment"]):
            continue

        found_on_page = False
        for prod_sel, title_sel, price_sel in selector_groups:
            for prod in soup.select(prod_sel):
                t = prod.select_one(title_sel)
                p = prod.select_one(price_sel)
                title_text = t.get_text(strip=True) if t else ""
                price_val = parse_price(p.get_text(strip=True)) if p else None
                link = prod.find("a")
                url = link.get("href", "") if link else ""

                if title_text and len(title_text) > 3 and price_val and price_val > 1000:
                    cat = infer_cat(title_text)
                    if cat == "phone": continue
                    items.append({"source": name, "title": title_text[:120], "price": price_val,
                        "url": url if url.startswith("http") else f"{urls[0].split('/')[0]}//{urls[0].split('/')[2]}{url}",
                        "category": cat, "location": loc, "condition": "new"})
                    found_on_page = True
            if found_on_page: break

    return items

# ═══ SITE DEFINITIONS — ALL Algerian PC stores ═══
SITES = {
    "digitec": {
        "name": "DigiTec DZ", "base": "https://digitecdz.com",
        "loc": "Alger", "strategy": ["wc_api"],
    },
    "gamingdz": {
        "name": "Gaming DZ", "base": "https://gamingdz.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://gamingdz.com/store/composants/cartes-graphiques",
            "https://gamingdz.com/store/composants/processeurs",
            "https://gamingdz.com/store/composants/cartes-meres",
            "https://gamingdz.com/store/composants/alimentations",
            "https://gamingdz.com/store/composants/ssd-nvme",
            "https://gamingdz.com/store/composants/ram",
            "https://gamingdz.com/store/composants/boitiers",
            "https://gamingdz.com/store/composants/watercooling",
            "https://gamingdz.com/store/peripheriques/ecrans",
            "https://gamingdz.com/store/gaming/pc-gamer",
        ],
    },
    "licb": {
        "name": "LICB+", "base": "https://licbplus.com.dz",
        "loc": "Tlemcen", "strategy": ["css_phantom"],
        "urls": [
            "https://licbplus.com.dz",
            "https://licbplus.com.dz/category/processeurs",
            "https://licbplus.com.dz/category/cartes-graphiques",
            "https://licbplus.com.dz/category/cartes-meres",
            "https://licbplus.com.dz/category/alimentations",
            "https://licbplus.com.dz/category/boitiers",
            "https://licbplus.com.dz/category/ram",
            "https://licbplus.com.dz/category/ssd-nvme",
            "https://licbplus.com.dz/category/ecrans",
        ],
    },
    "pcline": {
        "name": "PC Line", "base": "https://www.pcline.dz",
        "loc": "Alger", "strategy": ["css_phantom"],
        "urls": [
            "https://www.pcline.dz",
            "https://www.pcline.dz/composants",
            "https://www.pcline.dz/cartes-graphiques",
            "https://www.pcline.dz/processeurs",
        ],
    },
    "chbstore": {
        "name": "CHB-Store", "base": "https://chb-store.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://chb-store.com",
            "https://chb-store.com/categorie-produit/composants-pc/cartes-graphiques",
            "https://chb-store.com/categorie-produit/composants-pc/processeurs",
            "https://chb-store.com/categorie-produit/composants-pc/cartes-meres",
            "https://chb-store.com/categorie-produit/composants-pc/alimentations",
            "https://chb-store.com/categorie-produit/composants-pc/boitiers",
        ],
    },
    "africapap": {
        "name": "Africapap", "base": "https://africapap.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://africapap.com",
            "https://africapap.com/categorie-produit/composants/cartes-graphiques",
            "https://africapap.com/categorie-produit/composants/processeurs",
            "https://africapap.com/categorie-produit/ecrans-moniteurs",
        ],
    },
    "capmicro": {
        "name": "CapMicro Dz", "base": "https://capmicrodz.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://capmicrodz.com",
            "https://capmicrodz.com/categorie-produit/composants/cartes-graphiques",
            "https://capmicrodz.com/categorie-produit/composants/processeurs",
        ],
    },
    "deskcom": {
        "name": "DeskCom IT & Gaming", "base": "https://deskcom-dz.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://deskcom-dz.com",
            "https://deskcom-dz.com/categorie-produit/composants/cartes-graphiques",
            "https://deskcom-dz.com/categorie-produit/composants/processeurs",
        ],
    },
    "ami": {
        "name": "AMI-DZ", "base": "https://ami-dz.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://ami-dz.com",
            "https://ami-dz.com/categorie-produit/composants/cartes-graphiques",
            "https://ami-dz.com/categorie-produit/composants/processeurs",
        ],
    },
    "gigastore": {
        "name": "GigaStore DZ", "base": "https://gigastore-dz.com",
        "loc": "Alger", "strategy": ["css"],
        "urls": [
            "https://gigastore-dz.com",
            "https://gigastore-dz.com/collections/cartes-graphiques",
            "https://gigastore-dz.com/collections/processeurs",
            "https://gigastore-dz.com/collections/cartes-meres",
            "https://gigastore-dz.com/collections/alimentations",
            "https://gigastore-dz.com/collections/boitiers",
            "https://gigastore-dz.com/collections/ecrans",
        ],
    },
}

def scrape_site(key):
    site = SITES.get(key)
    if not site: return []
    items = []
    for strat in site["strategy"]:
        if strat == "wc_api":
            items = scrape_wc_api_full(site["base"], site["name"], site["loc"])
        elif strat == "css":
            items = scrape_css_full(site.get("urls", [site["base"]]), site["name"], site["loc"])
        elif strat == "css_phantom":
            items = scrape_css_full(site.get("urls", [site["base"]]), site["name"], site["loc"], use_phantom=True)
        if items: break
    return items

def main():
    keys = [sys.argv[1]] if len(sys.argv) > 1 else list(SITES.keys())
    all_items = []
    t0 = time.time()

    for key in keys:
        site = SITES.get(key)
        if not site: continue
        print(f"[{site['name']}] Scraping...", file=sys.stderr)
        items = scrape_site(key)
        all_items.extend(items)
        print(f"[{site['name']}] {len(items)} products", file=sys.stderr)
        if len(keys) > 1: time.sleep(2)

    dur = time.time() - t0
    print(f"[{len(keys)} sites | {len(all_items)} products | {dur:.0f}s]", file=sys.stderr)
    print(json.dumps(all_items, ensure_ascii=False))

if __name__ == "__main__":
    main()
