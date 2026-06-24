"""
Lahlou Industrie Scraper — https://lahlou-industrie.com
Shopify store. Static HTML — uses requests + BeautifulSoup.
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


class LahlouScraper:
    """Scraper for Lahlou Industrie — Shopify store."""

    CATEGORIES = {
        'cpu': 'https://lahlou-industrie.com/collections/cpu',
        'gpu': 'https://lahlou-industrie.com/collections/carte-graphique',
        'ram': 'https://lahlou-industrie.com/collections/memoire-ram',
        'motherboard': 'https://lahlou-industrie.com/collections/carte-mere-1',
        'storage': 'https://lahlou-industrie.com/collections/disque-stockage',
        'psu': 'https://lahlou-industrie.com/collections/alimentation',
        'case': 'https://lahlou-industrie.com/collections/boitier-pc',
        'cooling': 'https://lahlou-industrie.com/collections/refroidissement',
        'monitor': 'https://lahlou-industrie.com/collections/moniteur',
        'keyboard': 'https://lahlou-industrie.com/collections/peripheriques',
        'mouse': 'https://lahlou-industrie.com/collections/souris',
        'headset': 'https://lahlou-industrie.com/collections/casque-micro',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://lahlou-industrie.com'
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

        # Lahlou uses '#product-card' class — escape the # for CSS selector
        for card in soup.find_all('div', class_=lambda c: c and '#product-card' in c):
            try:
                link_el = card.find('a', href=lambda h: h and '/products/' in h)
                if not link_el:
                    continue

                name = link_el.get_text(strip=True).split('\n')[0].strip()
                url = link_el.get('href', '')
                if url and not url.startswith('http'):
                    url = self.base_url + url

                # Price — inside dd with #price-item-value
                price = ''
                old_price = None
                price_dd = card.find('dd', class_=lambda c: c and '#price-item-value' in c)
                if price_dd:
                    price_spans = price_dd.find_all('span', class_=lambda c: c and '#price-value' in c)
                    prices = [p.get_text(strip=True) for p in price_spans if p.get_text(strip=True)]
                    if prices:
                        price = prices[0]
                        if len(prices) > 1:
                            old_price = prices[1]

                if name and len(name) > 3 and price:
                    clean = price.replace('DA', '').replace(',', '').replace(' ', '').strip()
                    try:
                        float(clean)
                        products.append({
                            'name': name, 'price': price, 'old_price': old_price,
                            'availability': 'In stock', 'url': url, 'image': '',
                            'site': 'lahlou-industrie.com', 'retailer_name': 'Lahlou Industrie',
                            'sku': '', 'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue

        # Fallback: any /products/ link with nearby DA price
        if not products:
            for link in soup.find_all('a', href=lambda h: h and '/products/' in h):
                try:
                    name = link.get_text(strip=True).split('\n')[0].strip()
                    url = link.get('href', '')
                    if url and not url.startswith('http'):
                        url = self.base_url + url

                    parent = link.find_parent('div')
                    price = ''
                    if parent:
                        for s in parent.find_all(string=True):
                            s = s.strip()
                            if 'DA' in s:
                                clean = s.replace('DA', '').replace(',', '').replace(' ', '').strip()
                                try:
                                    if float(clean) > 100:
                                        price = s
                                        break
                                except ValueError:
                                    continue

                    if name and len(name) > 3 and price:
                        clean = price.replace('DA', '').replace(',', '').replace(' ', '').strip()
                        try:
                            float(clean)
                            products.append({
                                'name': name, 'price': price, 'old_price': None,
                                'availability': 'In stock', 'url': url, 'image': '',
                                'site': 'lahlou-industrie.com', 'retailer_name': 'Lahlou Industrie',
                                'sku': '', 'scraped_at': datetime.utcnow().isoformat(),
                            })
                        except ValueError:
                            pass
                except Exception:
                    continue

        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] Lahlou scraping {name}: {url}")
        all_products = []

        try:
            html = self._fetch(url)
            products = self._parse_page(html)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")
        except Exception as e:
            print(f"    [!] Failed: {e}")

        # Shopify pagination: ?page=N
        for page in range(2, 15):
            try:
                page_url = f"{url}?page={page}"
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
        print(f"\n[+] Lahlou: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = LahlouScraper()
    products = scraper.scrape_all(categories=['cpu', 'gpu'])
    print(f"Scraped {len(products)} products")
