"""
Matos Gaming Scraper — https://matos-gaming.com
WooCommerce store. Static HTML — uses requests + BeautifulSoup.
Scrapes monitors, mini-LED monitors, professional monitors, and audio.
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


class MatosScraper:
    """Scraper for Matos Gaming — Algerian gaming monitor brand (WooCommerce)."""

    CATEGORIES = {
        'monitor': 'https://matos-gaming.com/product-category/matos-gaming-monitors/',
        'mini-led': 'https://matos-gaming.com/product-category/matos-gaming-monitors/mini-led-monitors/',
        'professional': 'https://matos-gaming.com/product-category/matos-gaming-monitors/professional-monitors/',
        'audio': 'https://matos-gaming.com/product-category/audio/',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.base_url = 'https://matos-gaming.com'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        })

    def _fetch(self, url: str) -> str:
        import time, random
        time.sleep(random.uniform(0.8, self.delay))
        resp = self.session.get(url, timeout=20)
        resp.raise_for_status()
        return resp.text

    def _parse_price(self, text: str) -> tuple:
        """Extract current and old price from WooCommerce price text."""
        current_price = None
        old_price = None

        # Pattern: "Le prix initial était: د.ج 155,000.00. Le prix actuel est: د.ج 142,400.00."
        # Or: "د.ج 155,000.00" with sale tag
        lines = text.replace('\xa0', ' ').split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Extract all price-like numbers
            prices = []
            # Match patterns like "د.ج 155,000.00" or "155,000.00 د.ج"
            for match in __import__('re').finditer(r'[\d,\.]+', line):
                val = match.group().replace(',', '').replace(' ', '')
                try:
                    p = float(val)
                    if p > 1000:  # Sanity: PC component prices in DZ are > 1000
                        prices.append(p)
                except ValueError:
                    continue

            # If we have prices, the lower one is current (sale), higher is old
            if len(prices) >= 2:
                prices.sort()
                current_price = prices[0]
                old_price = prices[-1]
            elif len(prices) == 1:
                current_price = prices[0]

        # Format for raw text
        current_str = f"{current_price:,.0f} DA" if current_price else ''
        old_str = f"{old_price:,.0f} DA" if old_price else None
        return current_str, old_str, current_price, old_price

    def _parse_page(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'lxml')
        products = []

        # WooCommerce product cards — typically in li.product or div.product
        for card in soup.find_all('li', class_=lambda c: c and 'product' in c.lower()):
            try:
                # Product name — usually in h2.woocommerce-loop-product__title
                name_el = card.find('h2', class_=lambda c: c and 'woocommerce-loop-product__title' in c) or \
                          card.find('h2', class_=lambda c: c and 'product__title' in c) or \
                          card.find('a', class_=lambda c: c and 'woocommerce-LoopProduct-link' in c)
                if not name_el:
                    continue

                name = name_el.get_text(strip=True).split('\n')[0].strip()
                if not name or len(name) < 3:
                    continue

                # Product URL
                url = ''
                link = card.find('a', href=True)
                if link:
                    url = link.get('href', '')
                    if url and not url.startswith('http'):
                        url = self.base_url + url

                # Price — in span.price or div.price
                price_str = ''
                old_price = None
                price_el = card.find('span', class_='price') or card.find('div', class_='price')
                if price_el:
                    price_text = price_el.get_text(' ', strip=True)
                    price_str, old_price, _, _ = self._parse_price(price_text)

                # Image — Nectar theme uses data-nectar-img-src for lazyload
                image = ''
                img = card.find('img', class_=lambda c: c and 'attachment-woocommerce_thumbnail' in c)
                if img:
                    # Nectar lazy-load: actual image is in data-nectar-img-src
                    image = img.get('data-nectar-img-src') or img.get('data-src') or img.get('src', '')
                    # Skip SVG placeholders
                    if image and ('data:image/svg' in image or 'placeholder' in image):
                        image = img.get('data-nectar-img-src') or ''

                # Availability — check for "Non Disponible" or "Rupture"
                availability = 'In stock'
                card_text = card.get_text().lower()
                if 'non disponible' in card_text or 'rupture' in card_text or 'indisponible' in card_text:
                    availability = 'Out of stock'

                if name and price_str:
                    products.append({
                        'name': name,
                        'price': price_str,
                        'old_price': old_price,
                        'availability': availability,
                        'url': url,
                        'image': image,
                        'site': 'matos-gaming.com',
                        'retailer_name': 'Matos Gaming',
                        'sku': '',
                        'scraped_at': datetime.utcnow().isoformat(),
                    })
            except Exception:
                continue

        return products

    def scrape_category(self, url: str, name: str) -> List[Dict]:
        print(f"[+] Matos scraping {name}: {url}")
        all_products = []

        try:
            html = self._fetch(url)
            products = self._parse_page(html)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")
        except Exception as e:
            print(f"    [!] Failed: {e}")

        # WooCommerce pagination: /page/2/
        for page in range(2, 15):
            try:
                page_url = f"{url}page/{page}/" if not url.endswith('/') else f"{url}page/{page}/"
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
        print(f"\n[+] Matos: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = MatosScraper()
    products = scraper.scrape_all()
    print(f"Scraped {len(products)} products")
    for p in products[:3]:
        print(f"  {p['name']} @ {p['price']}")
