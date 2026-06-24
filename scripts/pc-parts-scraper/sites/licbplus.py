"""
LICB Plus Scraper — Static HTML (requests + BeautifulSoup)
https://www.licbplus.com.dz
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


class LicbplusScraper:
    """Fast static scraper for LICB Plus — no browser needed."""

    CATEGORIES = {
        'cpu': 'https://www.licbplus.com.dz/pc-components/processor',
        'gpu': 'https://www.licbplus.com.dz/pc-components/graphics-card',
        'ram': 'https://www.licbplus.com.dz/pc-components/ram-memory',
        'motherboard': 'https://www.licbplus.com.dz/pc-components/motherboard',
        'storage': 'https://www.licbplus.com.dz/pc-components/disque-dur',
        'monitor': 'https://www.licbplus.com.dz/monitor/pc-monitor',
        'psu': 'https://www.licbplus.com.dz/pc-components/power-supply',
        'case': 'https://www.licbplus.com.dz/pc-components/case',
        'cooling': 'https://www.licbplus.com.dz/pc-components/cooling',
        'keyboard': 'https://www.licbplus.com.dz/gaming/gaming-keyboard',
        'mouse': 'https://www.licbplus.com.dz/gaming/gaming-mouse',
        'headset': 'https://www.licbplus.com.dz/gaming/gaming-headset',
    }

    SELECTORS = {
        'card': 'div.product-cart-wrap',
        'name': 'h2 a.designation-truncate',
        'price': 'div.product-price span:not(.old-price)',
        'old_price': 'div.product-price span.old-price',
        'image': 'img.default-img',
        'badge': 'span.bac-inline-badge',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://www.licbplus.com.dz'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        })

    def _fetch(self, url: str) -> str:
        import time, random
        time.sleep(random.uniform(1, self.delay))
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        return resp.text

    def _parse_page(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'lxml')
        products = []

        for card in soup.select(self.SELECTORS['card']):
            try:
                name_el = card.select_one(self.SELECTORS['name'])
                if not name_el: continue

                name = name_el.get_text(strip=True)
                badge_el = card.select_one(self.SELECTORS['badge'])
                badge = badge_el.get_text(strip=True) if badge_el else ''

                price_el = card.select_one(self.SELECTORS['price'])
                price = price_el.get_text(strip=True) if price_el else ''

                old_price_el = card.select_one(self.SELECTORS['old_price'])
                old_price = old_price_el.get_text(strip=True) if old_price_el else None

                img_el = card.select_one(self.SELECTORS['image'])
                image = img_el.get('src', '') if img_el else ''

                link = name_el.get('href', '')
                if link and not link.startswith('http'): link = self.base_url + link

                product_id = card.get('data-id', '')

                # Clean price check
                clean = price.replace('DA', '').replace(' ', '').replace(',', '').strip()
                if name and clean:
                    try:
                        float(clean)
                        products.append({
                            'name': name,
                            'price': price,
                            'old_price': old_price,
                            'availability': badge or 'In stock',
                            'url': link,
                            'image': image,
                            'site': 'licbplus.com.dz',
                            'retailer_name': 'LICB Plus',
                            'sku': product_id or '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue
        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] LICB+ scraping {name}: {url}")
        all_products = []

        html = self._fetch(url)
        products = self._parse_page(html)
        all_products.extend(products)
        print(f"    Page 1: {len(products)} products")

        # Pagination
        for page in range(2, 10):
            try:
                html = self._fetch(f"{url}?page={page}")
                products = self._parse_page(html)
                if not products: break
                all_products.extend(products)
                print(f"    Page {page}: {len(products)} products")
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
                print(f"[!] Unknown category: {cat}")
                continue
            try:
                products = self.scrape_category(self.CATEGORIES[cat], cat)
                all_products.extend(products)
            except Exception as e:
                print(f"[!] Failed {cat}: {e}")
        print(f"\n[+] LICB Plus: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = LicbplusScraper()
    products = scraper.scrape_all(categories=['cpu', 'monitor'])
    print(f"Scraped {len(products)} products")
