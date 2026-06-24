"""
GeekZone DZ Scraper — https://www.geekzonedz.com
PrestaShop store. Static HTML — uses requests + BeautifulSoup.
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


class GeekZoneScraper:
    """Scraper for GeekZone DZ — PrestaShop store."""

    CATEGORIES = {
        'cpu': 'https://www.geekzonedz.com/23-processeurs',
        'gpu': 'https://www.geekzonedz.com/22-cartes-graphiques',
        'ram': 'https://www.geekzonedz.com/59-barrettes-memoire',
        'motherboard': 'https://www.geekzonedz.com/13-cartes-meres',
        'storage': 'https://www.geekzonedz.com/28-stockages',
        'psu': 'https://www.geekzonedz.com/26-alimentations',
        'case': 'https://www.geekzonedz.com/25-boitiers',
        'cooling': 'https://www.geekzonedz.com/27-refroidissements',
        'monitor': 'https://www.geekzonedz.com/32-moniteurs',
        'keyboard': 'https://www.geekzonedz.com/18-peripheriques?q=Categorie-Clavier',
        'mouse': 'https://www.geekzonedz.com/18-peripheriques?q=Categorie-Souris',
        'headset': 'https://www.geekzonedz.com/18-peripheriques?q=Categorie-Casque',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://www.geekzonedz.com'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        })

    def _fetch(self, url: str) -> str:
        import time, random
        time.sleep(random.uniform(0.8, self.delay))
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        return resp.text

    def _parse_page(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'lxml')
        products = []

        # GeekZone uses PrestaShop with li.product_item > div.product-miniature
        for item in soup.select('li.product_item, div.product-miniature'):
            try:
                # Name — from img alt or h2/h3
                name = ''
                img_el = item.select_one('img.primary-image, img.replace-2x, img')
                if img_el:
                    name = img_el.get('alt', '').strip()

                if not name:
                    h_el = item.select_one('h2, h3')
                    if h_el:
                        name = h_el.get_text(strip=True)

                # URL
                url = ''
                link_el = item.select_one('a.thumbnail, a.product-thumbnail, a.product_img_link')
                if link_el:
                    url = link_el.get('href', '')

                # Price
                price = ''
                old_price = None
                price_el = item.select_one('span.price, span.product-price, span.current-price')
                if price_el:
                    price = price_el.get_text(strip=True)

                old_el = item.select_one('span.old-price, del span.price, span.regular-price')
                if old_el:
                    old_price = old_el.get_text(strip=True)

                # Image
                image = ''
                if img_el:
                    image = img_el.get('src', '') or img_el.get('data-original', '') or img_el.get('data-src', '')

                # Clean price — handle French format with narrow no-break space
                clean = price.replace('DA', '').replace('\u202f', '').replace(' ', '').replace(',', '').strip()
                if name and clean:
                    try:
                        float(clean)
                        products.append({
                            'name': name,
                            'price': price,
                            'old_price': old_price,
                            'availability': 'In stock',
                            'url': url if url.startswith('http') else self.base_url + url,
                            'image': image,
                            'site': 'geekzonedz.com',
                            'retailer_name': 'GeekZone DZ',
                            'sku': '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue

        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] GeekZone scraping {name}: {url}")
        all_products = []
        seen_names = set()

        html = self._fetch(url)
        products = self._parse_page(html)
        for p in products:
            if p['name'] not in seen_names:
                seen_names.add(p['name'])
                all_products.append(p)
        print(f"    Page 1: {len(products)} products")

        for page in range(2, 8):  # Max 7 pages to avoid loops
            try:
                page_url = f"{url}?p={page}" if '?' not in url else f"{url}&p={page}"
                html = self._fetch(page_url)
                products = self._parse_page(html)
                if not products:
                    break
                # Deduplicate
                new_count = 0
                for p in products:
                    if p['name'] not in seen_names:
                        seen_names.add(p['name'])
                        all_products.append(p)
                        new_count += 1
                print(f"    Page {page}: {new_count} new products")
                if new_count == 0:  # Stop if no new products
                    break
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
        print(f"\n[+] GeekZone: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = GeekZoneScraper()
    products = scraper.scrape_all(categories=['cpu'])
    print(f"Scraped {len(products)} products")
