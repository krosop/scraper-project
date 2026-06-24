#!/usr/bin/env python3
"""
Generic Sitemap Scraper — Reads sitemap.json and scrapes all configured sites.
Ports the old Node.js multi-site scraper to Python with stealth headers,
retry logic, and adaptive parsing.
"""
import json
import random
import re
import time
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ─── Stealth Headers ───
BROWSER_PROFILES = [
    {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    },
    {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
    },
    {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
    },
]


def _random_profile():
    return random.choice(BROWSER_PROFILES).copy()


# ─── Price Parser ───
def _parse_price(text: str) -> Optional[float]:
    if not text:
        return None
    cleaned = str(text) \
        .replace('د.ج', '') \
        .replace('DZD', '').replace('Dzd', '').replace('dzd', '') \
        .replace('DA', '').replace('Da', '').replace('da', '') \
        .replace('Dinar', '').replace('DINAR', '') \
        .replace('Prix', '').replace('PRIX', '') \
        .replace(',', '') \
        .replace('\u00a0', ' ') \
        .strip()

    # European: "129.000,00" -> 129000
    m = re.search(r'(\d{1,3}(?:\.\d{3})+)(?:,\d+)?', cleaned)
    if m:
        return float(m.group(1).replace('.', ''))

    # Space-separated: "129 000" -> 129000
    m = re.search(r'(\d{1,3}(?:\s+\d{3})+)', cleaned)
    if m:
        return float(m.group(1).replace(' ', ''))

    # Plain: "39000"
    m = re.search(r'(\d{3,})', cleaned)
    if m:
        return float(m.group(1))

    return None


# ─── Cloudflare Detection ───
def _is_blocked(html: str, title: str) -> bool:
    if not html:
        return True
    checks = [
        'Cloudflare' in title,
        'Just a moment' in title,
        'Security check' in title,
        'cf-browser-verification' in html,
        'challenge-platform' in html,
        'Checking if the site connection is secure' in html,
        'DDoS protection by Cloudflare' in html,
        'data-dome' in html,
        'perimeterx' in html,
        'px-captcha' in html,
        'incap_ses' in html,
        'Access denied' in html,
        'Forbidden' in html,
    ]
    return any(checks)


# ─── Generic Site Scraper ───
class GenericSiteScraper:
    def __init__(self, site_def: dict):
        self.defn = site_def
        self.name = site_def['name']
        self.base_url = site_def['base_url'].rstrip('/')
        self.session = requests.Session()
        self.session.headers.update(_random_profile())

    def _fetch(self, url: str, retries: int = 2) -> Optional[str]:
        for attempt in range(1, retries + 1):
            try:
                time.sleep(self.defn.get('crawl_delay', 2))
                resp = self.session.get(url, timeout=20, allow_redirects=True)
                if resp.status_code == 404:
                    return None
                if resp.status_code in (403, 503):
                    print(f"    [{self.name}] BLOCKED ({resp.status_code}) at {url}")
                    return None
                resp.raise_for_status()
                html = resp.text
                title = BeautifulSoup(html, 'html.parser').title.string or '' if BeautifulSoup(html, 'html.parser').title else ''
                if _is_blocked(html, title):
                    print(f"    [{self.name}] Anti-bot detected at {url}")
                    return None
                return html
            except Exception as e:
                print(f"    [{self.name}] Fetch error (attempt {attempt}): {e}")
                if attempt < retries:
                    time.sleep(2 ** attempt)
        return None

    def _build_page_url(self, base_cat_url: str, page_num: int) -> str:
        pag = self.defn.get('pagination', {})
        ptype = pag.get('type', 'page_numbers')

        if ptype == 'page_numbers':
            url_pattern = pag.get('url_pattern', '/page/{page}/')
            return base_cat_url.rstrip('/') + url_pattern.replace('{page}', str(page_num))
        elif ptype == 'query_param':
            param = pag.get('param', 'page')
            sep = '&' if '?' in base_cat_url else '?'
            return f"{base_cat_url}{sep}{param}={page_num}"
        elif ptype == 'url_pattern':
            url_pattern = pag.get('url_pattern', '/page/{page}/')
            return base_cat_url.rstrip('/') + url_pattern.replace('{page}', str(page_num))
        else:
            return f"{base_cat_url.rstrip('/')}/page/{page_num}/"

    def _parse_page(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'html.parser')
        s = self.defn.get('selectors', {})
        products = []

        product_selector = s.get('product_list', '.product')
        name_selector = s.get('product_name', '.woocommerce-loop-product__title, h2, h3, .product-title, .product-name')
        price_selector = s.get('product_price', '.price bdi, .price .amount, .price, .woocommerce-Price-amount')
        link_selector = s.get('product_link', 'a')
        img_selector = s.get('product_image', 'img')

        cards = soup.select(product_selector)
        print(f"    Found {len(cards)} product cards")

        for card in cards:
            try:
                # Name
                title_el = card.select_one(name_selector)
                if not title_el:
                    # Fallback: any link with substantial text
                    links = card.find_all('a')
                    for a in links:
                        txt = a.get_text(strip=True)
                        if len(txt) > 5:
                            title_el = a
                            break
                if not title_el:
                    continue
                name = title_el.get_text(strip=True)
                if len(name) < 3:
                    continue

                # Price
                price_el = card.select_one(price_selector)
                price = _parse_price(price_el.get_text(strip=True)) if price_el else None
                if not price or price < 1000:
                    continue

                # URL
                url = ''
                link_el = card.select_one(link_selector)
                if link_el:
                    url = link_el.get('href', '')
                if not url and title_el.name == 'a':
                    url = title_el.get('href', '')
                if url and not url.startswith('http'):
                    url = self.base_url + url

                # Image
                img = ''
                img_el = card.select_one(img_selector)
                if img_el:
                    img = img_el.get('src', '') or img_el.get('data-src', '') or img_el.get('data-lazy-src', '')

                # Stock status
                stock_text = card.get_text(separator=' ', strip=True).lower()
                in_stock = 'out of stock' not in stock_text and 'rupture' not in stock_text and 'épuisé' not in stock_text

                products.append({
                    'name': name,
                    'price': f"{price:,.0f} DA",
                    'availability': 'In stock' if in_stock else 'Out of stock',
                    'url': url,
                    'image': img,
                    'site': self.defn.get('domain', ''),
                    'retailer_name': self.name,
                    'scraped_at': datetime.utcnow().isoformat(),
                })
            except Exception as e:
                continue

        return products

    def scrape(self, max_pages: int = 1) -> List[Dict]:
        print(f"\n[+] Scraping {self.name}...")
        all_products = []

        # Determine URLs to scrape
        urls_to_scrape = []
        urls = self.defn.get('urls', {})
        categories = urls.get('categories', [])
        if categories:
            # Limit to first 4 categories to keep runtime reasonable
            for cat in categories[:4]:
                urls_to_scrape.append(self.base_url + cat)
        elif urls.get('shop'):
            urls_to_scrape.append(self.base_url + urls['shop'])
        else:
            urls_to_scrape.append(self.base_url + urls.get('home', '/'))

        for cat_url in urls_to_scrape:
            for page_num in range(1, max_pages + 1):
                page_url = cat_url if page_num == 1 else self._build_page_url(cat_url, page_num)
                print(f"    Fetching: {page_url}")
                html = self._fetch(page_url)
                if html is None:
                    break
                products = self._parse_page(html)
                if not products:
                    print(f"    No products on page {page_num}, stopping pagination")
                    break
                all_products.extend(products)
                print(f"    Page {page_num}: {len(products)} products")
                if len(products) < 3:
                    break

        print(f"[+] {self.name}: {len(all_products)} total")
        return all_products


# ─── Main Runner ───
def load_sitemap(path: Path) -> List[dict]:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('sites', [])


def scrape_all_sites(sitemap_path: Path, max_pages: int = 1, max_sites: int = None) -> List[Dict]:
    sites = load_sitemap(sitemap_path)
    if max_sites:
        sites = sites[:max_sites]

    all_products = []
    for site_def in sites:
        try:
            scraper = GenericSiteScraper(site_def)
            products = scraper.scrape(max_pages=max_pages)
            all_products.extend(products)
        except Exception as e:
            print(f"[!] Failed to scrape {site_def.get('name', 'unknown')}: {e}")
            continue

    return all_products


if __name__ == '__main__':
    sitemap_path = Path(__file__).parent / 'sitemap.json'
    if not sitemap_path.exists():
        print(f"[!] sitemap.json not found at {sitemap_path}")
        exit(1)

    products = scrape_all_sites(sitemap_path, max_pages=1, max_sites=3)
    print(f"\n{'='*60}")
    print(f"  TOTAL: {len(products)} products from all sites")
    print(f"{'='*60}")

    # Save
    out = Path('data/raw/generic_scrape.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved to {out}")
