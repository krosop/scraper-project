"""
HardSoft DZ Scraper — https://hardsoft.dz
Custom PHP store. Static HTML — uses requests + BeautifulSoup.
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime
import re

sys.path.insert(0, str(Path(__file__).parent.parent))


class HardSoftScraper:
    """Scraper for HardSoft DZ — Custom PHP store."""

    # Categories map to IDs on the site
    # NOTE: These IDs may change. The scraper auto-discovers correct IDs from homepage.
    CATEGORIES = {
        'cpu': 'https://hardsoft.dz/categorie.php?id=4',       # Processeur
        'gpu': 'https://hardsoft.dz/categorie.php?id=19',      # Carte Graphique
        'ram': 'https://hardsoft.dz/categorie.php?id=26',      # RAM
        'motherboard': 'https://hardsoft.dz/categorie.php?id=1',   # Carte mère
        'storage': 'https://hardsoft.dz/categorie.php?id=6',   # Stockage
        'psu': 'https://hardsoft.dz/categorie.php?id=11',      # Alimentation
        'case': 'https://hardsoft.dz/categorie.php?id=28',     # Boitier
        'cooling': 'https://hardsoft.dz/categorie.php?id=47',  # Refroidisseurs
        'monitor-gamer': 'https://hardsoft.dz/categorie.php?id=83',  # Moniteur Gamer
        'monitor-office': 'https://hardsoft.dz/categorie.php?id=84', # Moniteur Bureautique
        'keyboard': 'https://hardsoft.dz/categorie.php?id=29', # Clavier
        'mouse': 'https://hardsoft.dz/categorie.php?id=2',     # Souris
        'headset': 'https://hardsoft.dz/categorie.php?id=73',  # Casque
        'thermal-paste': 'https://hardsoft.dz/categorie.php?id=88', # Pate thermique
        'pc-pack': 'https://hardsoft.dz/categorie.php?id=60',  # Pack composants
    }

    # Keywords to auto-discover categories from homepage
    CATEGORY_KEYWORDS = {
        'cpu': ['processeur', 'processor', 'cpu'],
        'gpu': ['carte graphique', 'graphics card', 'gpu'],
        'ram': ['ram', 'memoire', 'memory'],
        'motherboard': ['carte mere', 'motherboard'],
        'storage': ['stockage', 'disque', 'ssd', 'hdd'],
        'psu': ['alimentation', 'power supply'],
        'case': ['boitier', 'case'],
        'cooling': ['refroidissement', 'cooling'],
        'monitor-gamer': ['moniteur gamer', 'ecran gamer'],
        'monitor-office': ['moniteur bureautique', 'ecran bureautique'],
        'keyboard': ['clavier', 'keyboard'],
        'mouse': ['souris', 'mouse'],
        'headset': ['casque', 'headset'],
        'thermal-paste': ['pate thermique', 'thermal paste'],
        'pc-pack': ['pack composants', 'pack pc'],
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://hardsoft.dz'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        })

    def discover_categories(self) -> dict:
        """Auto-discover category IDs from homepage navigation."""
        print("    [i] Discovering category IDs from homepage...")
        try:
            html = self._fetch(self.base_url)
            soup = BeautifulSoup(html, 'lxml')
            discovered = {}

            # Find all links to categorie.php?id=X
            for link in soup.find_all('a', href=re.compile(r'categorie\.php\?id=(\d+)')):
                href = link.get('href', '')
                text = link.get_text(strip=True).lower()
                match = re.search(r'id=(\d+)', href)
                if not match:
                    continue
                cat_id = match.group(1)
                full_url = href if href.startswith('http') else self.base_url + '/' + href.lstrip('/')

                # Match against keywords
                for cat_key, keywords in self.CATEGORY_KEYWORDS.items():
                    if cat_key in discovered:
                        continue
                    for kw in keywords:
                        if kw in text:
                            discovered[cat_key] = full_url
                            print(f"    [+] {cat_key}: {full_url}")
                            break

            return discovered
        except Exception as e:
            print(f"    [!] Discovery failed: {e}")
            return {}

    def _fetch(self, url: str) -> str:
        import time, random
        time.sleep(random.uniform(0.8, self.delay))
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        return resp.text

    def _parse_page(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'lxml')
        products = []

        # HardSoft uses custom PHP — look for product containers
        # Common patterns: table rows, divs with product info, etc.

        # Try table-based layout first
        for row in soup.select('table tr, div.product-item, div.item'):
            try:
                # Find name link
                link_el = row.select_one('a[href*="produit.php?id="], a[href*="produit.php"]')
                if not link_el:
                    continue

                name = link_el.get_text(strip=True)
                url = link_el.get('href', '')
                if url and not url.startswith('http'):
                    url = self.base_url + '/' + url.lstrip('/')

                # Find price — usually in a specific format
                price = ''
                old_price = None

                # Look for price in the row
                for text in row.find_all(string=re.compile(r'\d+[\s,]*\d*\.?\d*\s*DA')):
                    price_text = text.strip()
                    if price_text:
                        clean = price_text.replace('DA', '').replace(' ', '').replace(',', '').strip()
                        try:
                            float(clean)
                            if not price:
                                price = price_text
                            elif not old_price:
                                old_price = price_text
                                break
                        except ValueError:
                            continue

                # Also try specific selectors
                if not price:
                    price_el = row.select_one('.prix, .price, span[class*="prix"], div[class*="prix"]')
                    if price_el:
                        price = price_el.get_text(strip=True)

                # Image
                img_el = row.select_one('img')
                image = ''
                if img_el:
                    image = img_el.get('src', '')
                    if image and not image.startswith('http'):
                        image = self.base_url + '/' + image.lstrip('/')

                # Clean price
                if name and price:
                    clean = price.replace('DA', '').replace(' ', '').replace(',', '').strip()
                    try:
                        float(clean)
                        products.append({
                            'name': name,
                            'price': price,
                            'old_price': old_price,
                            'availability': 'In stock',
                            'url': url,
                            'image': image,
                            'site': 'hardsoft.dz',
                            'retailer_name': 'HardSoft DZ',
                            'sku': '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                    except ValueError:
                        pass
            except Exception:
                continue

        # Second approach: look for any links to produit.php with prices nearby
        if not products:
            for link in soup.find_all('a', href=re.compile(r'produit\.php\?id=')):
                try:
                    name = link.get_text(strip=True)
                    url = link.get('href', '')
                    if url and not url.startswith('http'):
                        url = self.base_url + '/' + url.lstrip('/')

                    # Find price in parent container
                    parent = link.find_parent('div') or link.find_parent('td') or link.find_parent('tr')
                    price = ''
                    if parent:
                        for el in parent.find_all(string=re.compile(r'\d+[\s,]*\d*\.?\d*\s*DA')):
                            text = el.strip()
                            clean = text.replace('DA', '').replace(' ', '').replace(',', '').strip()
                            try:
                                if float(clean) > 100:
                                    price = text
                                    break
                            except ValueError:
                                continue

                    if name and len(name) > 3 and price:
                        products.append({
                            'name': name,
                            'price': price,
                            'old_price': None,
                            'availability': 'In stock',
                            'url': url,
                            'image': '',
                            'site': 'hardsoft.dz',
                            'retailer_name': 'HardSoft DZ',
                            'sku': '',
                            'scraped_at': datetime.utcnow().isoformat(),
                        })
                except Exception:
                    continue

        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] HardSoft scraping {name}: {url}")
        all_products = []

        try:
            html = self._fetch(url)
            products = self._parse_page(html)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")
        except Exception as e:
            print(f"    [!] Failed to fetch: {e}")

        # Pagination — custom PHP may use ?page=N or &p=N
        for page in range(2, 10):
            try:
                if '?' in url:
                    page_url = f"{url}&page={page}"
                else:
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
        # Try to auto-discover correct category IDs first
        discovered = self.discover_categories()
        if discovered:
            self.CATEGORIES.update(discovered)

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
        print(f"\n[+] HardSoft: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = HardSoftScraper()
    products = scraper.scrape_all(categories=['cpu'])
    print(f"Scraped {len(products)} products")
