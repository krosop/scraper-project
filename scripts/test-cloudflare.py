#!/usr/bin/env python3
"""
Cloudflare Bypass Test v2 — Multi-strategy
1. cloudscraper for CF challenge
2. WordPress REST API (bypasses CF entirely)
3. JavaScript data extraction (React/Vue embedded data)
4. curl-impersonate style (TLS fingerprint)
"""

import cloudscraper
import json
import time
import re
from bs4 import BeautifulSoup

scraper = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False},
    delay=8,
)

def log(s, src, msg):
    print(f"[{s}] [{src}] {msg}")

def parse_price(text):
    if not text: return None
    cleaned = text.lower().replace("د.ج","").replace("dzd","").replace("da","").replace(",","").strip()
    m = re.search(r'(\d{1,3}(?:\.\d{3})+)', cleaned)
    if m: return int(m.group(1).replace(".",""))
    m = re.search(r'(\d{1,3}(?:\s+\d{3})+)', cleaned)
    if m: return int(m.group(1).replace(" ",""))
    m = re.search(r'(\d{3,})', cleaned)
    if m: return int(m.group(1))
    return None

def infer_cat(title):
    t = title.lower()
    if any(k in t for k in ["rtx","gtx","radeon","rx ","carte graphique"]): return "pc_part"
    if any(k in t for k in ["processeur","ryzen","core i","intel","cpu"]): return "pc_part"
    if any(k in t for k in ["ecran","monitor","moniteur","oled"]): return "monitor"
    if any(k in t for k in ["carte mere","carte mère","motherboard","b760","h610","a620"]): return "pc_part"
    if any(k in t for k in ["alimentation","psu","w ","watt"]): return "pc_part"
    if any(k in t for k in ["boitier","case","chassis"]): return "pc_part"
    if any(k in t for k in ["ram ","ddr"]): return "pc_part"
    if any(k in t for k in ["ssd","nvme"]): return "pc_part"
    return "pc_part"

# ═══ STRATEGY 1: WordPress REST API ═══
def try_wp_api(base_url, name):
    """WooCommerce sites expose a REST API that often bypasses CF"""
    endpoints = [
        f"{base_url}/wp-json/wc/v3/products?per_page=100&page=1",
        f"{base_url}/wp-json/wc/store/v1/products?per_page=100",
        f"{base_url}/wp-json/wp/v2/posts?per_page=100",
    ]
    items = []

    for ep in endpoints:
        try:
            log("INFO", name, f"WP API: {ep}")
            resp = scraper.get(ep, timeout=20)
            log("INFO", name, f"  HTTP {resp.status_code}, CT: {resp.headers.get('content-type','?')}")

            if resp.status_code == 200 and 'json' in resp.headers.get('content-type', ''):
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    log("SUCCESS", name, f"  JSON array with {len(data)} items!")
                    # Show first item structure
                    sample = data[0]
                    log("INFO", name, f"  Keys: {list(sample.keys())[:10]}")

                    for p in data:
                        title = p.get('name', p.get('title', {}).get('rendered', '') if isinstance(p.get('title'), dict) else p.get('title', ''))
                        price = None
                        if 'price' in p:
                            price = parse_price(str(p['price']))
                        elif 'price_html' in p:
                            price = parse_price(p['price_html'])

                        if title and price and price > 1000:
                            items.append({
                                'source': name, 'title': title[:120], 'price': price,
                                'url': p.get('permalink', p.get('link', '')),
                                'category': infer_cat(title), 'location': 'Algeria'
                            })

                    if items:
                        log("SUCCESS", name, f"  Extracted {len(items)} products from API!")
                        return items

        except Exception as e:
            log("WARN", name, f"  API error: {str(e)[:80]}")

    return items

# ═══ STRATEGY 2: Extract embedded JS data ═══
def try_js_data(html, name):
    """Look for __NEXT_DATA__, __INITIAL_STATE__, window.__data, etc."""
    items = []
    soup = BeautifulSoup(html, 'lxml')

    # Check for script tags with data
    scripts = soup.find_all('script')
    log("INFO", name, f"  {len(scripts)} script tags found")

    # Look for specific patterns
    patterns = [
        (r'window\.__NEXT_DATA__\s*=\s*({.*?});', "__NEXT_DATA__"),
        (r'window\.__INITIAL_STATE__\s*=\s*({.*?});', "__INITIAL_STATE__"),
        (r'window\.__data\s*=\s*({.*?});', "__data"),
        (r'var\s+\w*data\w*\s*=\s*({.*?});', "data var"),
    ]

    for script in scripts:
        text = script.string if script.string else ""
        if not text or len(text) < 50:
            continue

        for pattern, label in patterns:
            matches = re.findall(pattern, text, re.DOTALL)
            if matches:
                log("SUCCESS", name, f"  Found {label}! ({len(matches[0])} chars)")
                try:
                    data = json.loads(matches[0])
                    log("INFO", name, f"  Parsed JSON keys: {list(data.keys())[:10] if isinstance(data, dict) else 'array'}")
                    # Recursively search for products
                    products = find_products_in_json(data)
                    if products:
                        log("SUCCESS", name, f"  Found {len(products)} products in JSON!")
                        return products
                except json.JSONDecodeError:
                    pass

    # Look for JSON-LD structured data
    ld_scripts = soup.find_all('script', type='application/ld+json')
    log("INFO", name, f"  {len(ld_scripts)} JSON-LD scripts")
    for ld in ld_scripts:
        try:
            data = json.loads(ld.string)
            if isinstance(data, dict) and data.get('@type') == 'Product':
                title = data.get('name', '')
                price = None
                if 'offers' in data:
                    offer = data['offers']
                    if isinstance(offer, dict):
                        price = parse_price(str(offer.get('price', '')))
                    elif isinstance(offer, list) and offer:
                        price = parse_price(str(offer[0].get('price', '')))
                if title and price and price > 1000:
                    items.append({'source': name, 'title': title[:120], 'price': price,
                                  'url': data.get('url', ''), 'category': infer_cat(title), 'location': 'Algeria'})
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get('@type') == 'Product':
                        title = item.get('name', '')
                        p = None
                        if 'offers' in item and isinstance(item['offers'], dict):
                            p = parse_price(str(item['offers'].get('price', '')))
                        if title and p and p > 1000:
                            items.append({'source': name, 'title': title[:120], 'price': p,
                                          'url': item.get('url', ''), 'category': infer_cat(title), 'location': 'Algeria'})
        except:
            pass

    if items:
        log("SUCCESS", name, f"  Extracted {len(items)} from JSON-LD")
    return items

def find_products_in_json(obj, depth=0):
    """Recursively find product arrays in JSON"""
    if depth > 10:
        return []
    products = []

    if isinstance(obj, list):
        for item in obj[:200]:  # Limit search
            if isinstance(item, dict):
                # Check if this looks like a product
                name = item.get('name', item.get('title', item.get('product_name', '')))
                price = item.get('price', item.get('regular_price', item.get('sale_price', '')))
                if name and price:
                    try:
                        p = parse_price(str(price))
                        if p and p > 1000:
                            products.append({
                                'source': '', 'title': str(name)[:120], 'price': p,
                                'url': item.get('permalink', item.get('url', item.get('link', ''))),
                                'category': infer_cat(str(name)), 'location': 'Algeria'
                            })
                    except:
                        pass
                else:
                    products.extend(find_products_in_json(item, depth + 1))

    elif isinstance(obj, dict):
        # Check known product container keys
        for key in ['products', 'items', 'data', 'results', 'posts', 'list', 'collection']:
            if key in obj and isinstance(obj[key], list):
                found = find_products_in_json(obj[key], depth + 1)
                if found:
                    products.extend(found)
                    break
        else:
            for v in obj.values():
                if isinstance(v, (dict, list)):
                    found = find_products_in_json(v, depth + 1)
                    if found:
                        products.extend(found)

    return products

# ═══ STRATEGY 3: CSS selector scan ═══
def try_all_selectors(html, name):
    """Try many different CSS selectors to find products"""
    soup = BeautifulSoup(html, 'lxml')
    items = []

    # Common product selectors for Algerian sites
    selector_groups = [
        # WooCommerce
        ('.product.type-product', '.woocommerce-loop-product__title', '.price'),
        ('.product', 'h2.woocommerce-loop-product__title', '.price'),
        ('ul.products li', 'h2, h3', '.price'),
        # Generic
        ('.product-item', '.product-title, h2, h3', '.product-price, .price'),
        ('.product-card', '.product-title, h2, h3', '.product-price, .price'),
        ('.item-product', 'h2, h3, .title', '.price'),
        ('[class*="product"]', 'h2, h3, .title, [class*="name"]', '.price, [class*="price"]'),
        ('.card', 'h2, h3, .title', '.price'),
        # LICB+ specific (from sitemap)
        ('.product-card', '.product-title', '.product-price'),
        # Gaming DZ specific
        ('.product-item', '.product-title', '.product-price'),
    ]

    for prod_sel, title_sel, price_sel in selector_groups:
        products = soup.select(prod_sel)
        if products:
            log("INFO", name, f"  Selector '{prod_sel}': {len(products)} matches")
            for prod in products[:10]:
                title_el = prod.select_one(title_sel)
                price_el = prod.select_one(price_sel)
                title = title_el.get_text(strip=True) if title_el else ""
                price = parse_price(price_el.get_text(strip=True)) if price_el else None
                link = prod.find('a')
                url = link.get('href', '') if link else ''

                if title and len(title) > 3 and price and price > 1000:
                    items.append({'source': name, 'title': title[:120], 'price': price,
                                  'url': url, 'category': infer_cat(title), 'location': 'Algeria'})

            if items:
                log("SUCCESS", name, f"  Extracted {len(items)} with '{prod_sel}'")
                return items

    return items

# ═══ MAIN ═══
def main():
    print("=" * 60)
    print("  Cloudflare Bypass — Multi-Strategy Test")
    print("=" * 60)
    print()

    sites = [
        {"name": "LICB+", "base": "https://www.licbplus.com.dz",
         "urls": ["https://www.licbplus.com.dz", "https://www.licbplus.com.dz/pc-components/cartes-graphiques"]},
        {"name": "Gaming DZ", "base": "https://gamingdz.com",
         "urls": ["https://gamingdz.com", "https://gamingdz.com/store/composants/cartes-graphiques"]},
        {"name": "PC Line", "base": "https://www.pcline.dz",
         "urls": ["https://www.pcline.dz"]},
        {"name": "DigiTec DZ", "base": "https://digitecdz.com",
         "urls": ["https://digitecdz.com"]},
    ]

    all_products = []

    for site in sites:
        name = site["name"]
        print(f"\n{'─' * 50}")
        print(f"  Testing: {name}")
        print(f"{'─' * 50}")

        # Step 1: Fetch with cloudscraper
        html = None
        for url in site["urls"]:
            try:
                log("INFO", name, f"Fetching: {url}")
                resp = scraper.get(url, timeout=25)
                log("INFO", name, f"HTTP {resp.status_code}, {len(resp.text)} bytes")

                if resp.status_code == 200 and len(resp.text) > 10000:
                    soup = BeautifulSoup(resp.text, 'lxml')
                    title = soup.title.string.strip() if soup.title else "No title"
                    log("INFO", name, f"Title: \"{title[:60]}\"")

                    # Check if we got real content (not a challenge page)
                    if "challenge" not in resp.text.lower() and "cf-browser-verification" not in resp.text.lower():
                        html = resp.text
                        break
                    else:
                        log("WARN", name, "Challenge page detected")

            except Exception as e:
                log("ERROR", name, f"Fetch failed: {str(e)[:80]}")

        if not html:
            log("ERROR", name, "Could not fetch valid HTML")
            continue

        # Strategy 1: WordPress REST API
        log("INFO", name, "Strategy 1: WordPress REST API")
        api_items = try_wp_api(site["base"], name)
        if api_items:
            all_products.extend(api_items)
            continue

        # Strategy 2: Embedded JS data
        log("INFO", name, "Strategy 2: Embedded JavaScript data")
        js_items = try_js_data(html, name)
        if js_items:
            all_products.extend(js_items)
            continue

        # Strategy 3: CSS selectors
        log("INFO", name, "Strategy 3: CSS selector scan")
        css_items = try_all_selectors(html, name)
        if css_items:
            all_products.extend(css_items)
            continue

        log("ERROR", name, "All strategies failed")

        time.sleep(3)

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  RESULTS: {len(all_products)} products total")
    print(f"{'=' * 60}")
    by_source = {}
    for p in all_products:
        by_source[p['source']] = by_source.get(p['source'], 0) + 1
    for src, cnt in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {src:<20} {cnt:>3} products")

    if all_products:
        print(f"\n  Top 10 cheapest:")
        for p in sorted(all_products, key=lambda x: x['price'])[:10]:
            print(f"    {str(p['price']).rjust(7)} DZD  {p['title'][:50]}")

    with open("scripts/cloudflare-bypass-results.json", "w") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total": len(all_products),
            "by_source": by_source,
            "products": all_products,
        }, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved to scripts/cloudflare-bypass-results.json")

if __name__ == "__main__":
    main()
