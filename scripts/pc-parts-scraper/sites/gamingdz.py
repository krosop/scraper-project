"""
Gaming DZ Scraper — https://gamingdz.com
Custom SaaS platform. Static HTML — uses requests + BeautifulSoup.
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


class GamingDZScraper:
    """Scraper for Gaming DZ — Custom e-commerce platform."""

    CATEGORIES = {
        'cpu': 'https://gamingdz.com/store/composants/processeurs-cpu',
        'gpu': 'https://gamingdz.com/store/composants/cartes-graphiques',
        'ram': 'https://gamingdz.com/store/composants/memoire-ram',
        'motherboard': 'https://gamingdz.com/store/composants/cartes-meres',
        'storage': 'https://gamingdz.com/store/composants/stockage',
        'psu': 'https://gamingdz.com/store/composants/alimentations-psu',
        'case': 'https://gamingdz.com/store/composants/boitiers-case',
        'cooling': 'https://gamingdz.com/store/composants/refroidisseur-cpu',
        'monitor': 'https://gamingdz.com/store/moniteurs',
        'keyboard': 'https://gamingdz.com/store/peripheriques/claviers',
        'mouse': 'https://gamingdz.com/store/peripheriques/souris',
        'headset': 'https://gamingdz.com/store/peripheriques/casques-et-micros',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://gamingdz.com'
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

        # Try multiple selector patterns for this custom platform
        selectors = [
            'div.product-item',
            'div[data-product]',
            'div.single-product',
            'article.product',
            'div[class*="product"]',
        ]

        cards = []
        for sel in selectors:
            cards = soup.select(sel)
            if cards:
                break

        # Fallback: look for any div containing price + name pattern
        if not cards:
            for div in soup.find_all('div'):
                price_el = div.find(string=lambda t: t and 'DA' in t)
                name_el = div.find('h3') or div.find('h2') or div.find('a')
                if price_el and name_el:
                    cards.append(div)

        for card in cards[:100]:  # Limit to avoid false positives
            try:
                # Name
                name_el = card.select_one('h3, h2, .product-title, a[data-product]')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)

                # URL
                url = ''
                link_el = card.select_one('a')
                if link_el:
                    url = link_el.get('href', '')
                if url and not url.startswith('http'):
                    url = self.base_url + url

                # Price — look for text containing DA
                price = ''
                old_price = None
                for el in card.find_all(string=lambda t: t and 'DA' in t):
                    text = el.strip()
                    if text:
                        # Try to find price pattern
                        clean = text.replace('DA', '').replace(' ', '').replace(',', '').strip()
                        try:
                            float(clean)
                            if not price:
                                price = text
                            elif not old_price:
                                old_price = text
                                break
                        except ValueError:
                            continue

                # Image
                img_el = card.select_one('img')
                image = img_el.get('src', '') if img_el else ''

                # Clean price check
                clean = price.replace('DA', '').replace(' ', '').replace(',', '').strip()
                if name and clean and len(name) > 3:
                    try:
                        float(clean)
                        products.append({
                            'name': name,
                            'price': price,
                            'old_price': old_price,
                            'availability': 'In stock',
                            'url': url,
                            'image': image,
                            'site': 'gamingdz.com',
                            'retailer_name': 'Gaming DZ',
                            'sku': '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue
        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] Gaming DZ scraping {name}: {url}")
        all_products = []

        try:
            html = self._fetch(url)
            products = self._parse_page(html)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")
        except Exception as e:
            print(f"    [!] Failed to fetch: {e}")
            return all_products

        # Pagination — try common patterns
        for page in range(2, 10):
            try:
                # Try ?page=N, &page=N, /page/N/
                page_urls = [
                    f"{url}?page={page}",
                    f"{url}&page={page}",
                    f"{url}/page/{page}/",
                ]
                for page_url in page_urls:
                    html = self._fetch(page_url)
                    products = self._parse_page(html)
                    if products:
                        all_products.extend(products)
                        print(f"    Page {page}: {len(products)} products")
                        break
                else:
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
        print(f"\n[+] Gaming DZ: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = GamingDZScraper()
    products = scraper.scrape_all(categories=['gpu'])
    print(f"Scraped {len(products)} products")
