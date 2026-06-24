"""
WIFI Djelfa Scraper — Cloudflare-protected, uses Scrapling StealthyFetcher
https://wifidjelfa.com
"""
import sys
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from scrapling.fetchers import StealthyFetcher
    SCRAPLING_OK = True
except ImportError:
    SCRAPLING_OK = False
    print("[!] pip install 'scrapling[fetchers]' && scrapling install")


class WifidjelfaScraper:
    """Stealth scraper for WIFI Djelfa — bypasses Cloudflare."""

    CATEGORIES = {
        'cpu': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008520/',
        'gpu': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008523/',
        'ram': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008525/',
        'motherboard': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008524/',
        'storage': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008527/',
        'monitor': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008521/',
        'psu': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008526/',
        'case': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008528/',
        'cooling': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008529/',
        'keyboard': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008532/',
        'mouse': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008533/',
        'headset': 'https://wifidjelfa.com/product-category/99236150627014130/99236150627008534/',
        'desktop': 'https://wifidjelfa.com/product-category/99940244966604812/',
    }

    def __init__(self):
        if not SCRAPLING_OK:
            raise ImportError("Scrapling required: pip install 'scrapling[fetchers]'")

    def _fetch(self, url: str) -> str:
        print(f"    [Browser] Fetching {url}")
        page = StealthyFetcher.fetch(url, headless=True, network_idle=True, solve_cloudflare=True)
        html = page.text()
        print(f"    [Browser] Loaded: {len(html)} bytes")
        return html

    def _parse(self, html: str) -> List[Dict]:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'lxml')
        products = []

        cards = soup.select('div.wd-product.product-grid-item')
        print(f"    Found {len(cards)} product cards")

        for card in cards:
            try:
                product_id = card.get('data-id', '')
                title_el = card.select_one('h3.wd-entities-title a')
                if not title_el:
                    title_el = card.select_one('.wd-entities-title a')
                if not title_el: continue

                name = title_el.get_text(strip=True)
                url = title_el.get('href', '')
                if url and not url.startswith('http'): url = 'https://wifidjelfa.com' + url
                if '/product/' not in url: continue

                # Price
                price_container = card.select_one('span.price')
                price = ''
                old_price = None
                if price_container:
                    sale_price = price_container.select_one('ins .woocommerce-Price-amount bdi')
                    if sale_price:
                        price = sale_price.get_text(strip=True)
                        old_el = price_container.select_one('del .woocommerce-Price-amount bdi')
                        if old_el: old_price = old_el.get_text(strip=True)
                    else:
                        reg = price_container.select_one('.woocommerce-Price-amount bdi')
                        if reg: price = reg.get_text(strip=True)

                # Image
                img = card.select_one('img')
                image = img.get('src', '') or img.get('data-src', '') if img else ''

                # Stock
                in_stock = 'out-of-stock' not in ' '.join(card.get('class', []))

                clean = price.replace('DA', '').replace(' ', '').replace(',', '').strip()
                if name and clean:
                    try:
                        float(clean)
                        products.append({
                            'name': name, 'price': price, 'old_price': old_price,
                            'availability': 'In stock' if in_stock else 'Out of stock',
                            'url': url, 'image': image,
                            'site': 'wifidjelfa.com', 'retailer_name': 'WIFI Djelfa',
                            'sku': product_id or '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue
        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] WIFI Djelfa scraping {name}: {url}")
        all_products = []

        html = self._fetch(url)
        products = self._parse(html)
        all_products.extend(products)
        print(f"    Page 1: {len(products)} products")

        for page in range(2, 20):
            try:
                html = self._fetch(f"{url.rstrip('/')}/page/{page}/")
                products = self._parse(html)
                if not products: break
                all_products.extend(products)
                print(f"    Page {page}: {len(products)} products")
                if len(products) < 3: break
            except Exception as e:
                print(f"    Pagination stopped: {e}")
                break

        print(f"[+] {name}: {len(all_products)} total")
        return all_products

    def scrape_all(self, categories: list = None) -> List[Dict]:
        cats = categories or list(self.CATEGORIES.keys())
        all_products = []
        for cat in cats:
            if cat not in self.CATEGORIES:
                print(f"[!] Unknown: {cat}"); continue
            try:
                products = self.scrape_category(self.CATEGORIES[cat], cat)
                all_products.extend(products)
            except Exception as e:
                print(f"[!] Failed {cat}: {e}")
        print(f"\n[+] WIFI Djelfa: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = WifidjelfaScraper()
    products = scraper.scrape_all(categories=['cpu'])
    print(f"Scraped {len(products)} products")
