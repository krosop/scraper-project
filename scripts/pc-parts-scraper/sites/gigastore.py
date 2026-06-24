"""
GigaStore DZ Scraper — https://gigastore-dz.com
WordPress/WooCommerce. Static HTML — uses requests + BeautifulSoup.
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


class GigastoreScraper:
    """Scraper for GigaStore DZ — WooCommerce store."""

    CATEGORIES = {
        'cpu': 'https://gigastore-dz.com/composants/processeur/',
        'gpu': 'https://gigastore-dz.com/composants/carte-graphique/',
        'ram': 'https://gigastore-dz.com/composants/ram/',
        'motherboard': 'https://gigastore-dz.com/composants/carte-mere/',
        'storage': 'https://gigastore-dz.com/composants/stockage-ssd-hdd/',
        'psu': 'https://gigastore-dz.com/composants/alimentation/',
        'case': 'https://gigastore-dz.com/composants/boitier/',
        'cooling': 'https://gigastore-dz.com/composants/refroidissement/',
        'monitor': 'https://gigastore-dz.com/moniteur/',
        'keyboard': 'https://gigastore-dz.com/peripheriques/clavier/',
        'mouse': 'https://gigastore-dz.com/peripheriques/souris/',
        'headset': 'https://gigastore-dz.com/peripheriques/casque/',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://gigastore-dz.com'
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

        # GigaStore uses li.product (not div.product)
        for card in soup.select('li.product'):
            try:
                name_el = card.select_one('h2.woocommerce-loop-product__title a, a.woocommerce-LoopProduct-link h2')
                if not name_el:
                    continue

                name = name_el.get_text(strip=True)
                url = ''
                link_el = card.select_one('a.woocommerce-LoopProduct-link')
                if link_el:
                    url = link_el.get('href', '')

                price_el = card.select_one('span.woocommerce-Price-amount bdi')
                price = price_el.get_text(strip=True) if price_el else ''

                old_price_el = card.select_one('del span.woocommerce-Price-amount bdi')
                old_price = old_price_el.get_text(strip=True) if old_price_el else None

                img_el = card.select_one('img.attachment-woocommerce_thumbnail, img.woocommerce-placeholder')
                image = ''
                if img_el:
                    image = img_el.get('src', '') or img_el.get('data-src', '') or img_el.get('data-lazy-src', '')

                badge_el = card.select_one('span.onsale')
                badge = badge_el.get_text(strip=True) if badge_el else ''

                clean = price.replace('DA', '').replace(' ', '').replace(',', '').strip()
                if name and clean:
                    try:
                        float(clean)
                        products.append({
                            'name': name,
                            'price': price,
                            'old_price': old_price,
                            'availability': badge or 'In stock',
                            'url': url,
                            'image': image,
                            'site': 'gigastore-dz.com',
                            'retailer_name': 'GigaStore DZ',
                            'sku': '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue
        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] GigaStore scraping {name}: {url}")
        all_products = []

        html = self._fetch(url)
        products = self._parse_page(html)
        all_products.extend(products)
        print(f"    Page 1: {len(products)} products")

        for page in range(2, 15):
            try:
                page_url = f"{url}page/{page}/"
                html = self._fetch(page_url)
                products = self._parse_page(html)
                if not products:
                    break
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
                print(f"[!] Unknown: {cat}"); continue
            try:
                products = self.scrape_category(self.CATEGORIES[cat], cat)
                all_products.extend(products)
            except Exception as e:
                print(f"[!] Failed {cat}: {e}")
        print(f"\n[+] GigaStore: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = GigastoreScraper()
    products = scraper.scrape_all(categories=['cpu', 'gpu'])
    print(f"Scraped {len(products)} products")
