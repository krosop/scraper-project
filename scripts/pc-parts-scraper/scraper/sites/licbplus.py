"""
LICB Plus Scraper — Updated with correct URLs and selectors
"""
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from typing import List, Dict

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scraper.base import BaseScraper


class LicbplusScraper(BaseScraper):
    """Scraper for LICB Plus — Algerian PC retailer."""

    CATEGORIES = {
        'monitor': 'https://www.licbplus.com.dz/monitor/pc-monitor',
        'cpu': 'https://www.licbplus.com.dz/pc-components/processor',
        'gpu': 'https://www.licbplus.com.dz/pc-components/graphics-card',
        'ram': 'https://www.licbplus.com.dz/pc-components/memory',
        'motherboard': 'https://www.licbplus.com.dz/pc-components/motherboard',
        'storage': 'https://www.licbplus.com.dz/pc-components/hard-drive',
        'ssd': 'https://www.licbplus.com.dz/pc-components/ssd',
        'psu': 'https://www.licbplus.com.dz/pc-components/power-supply',
        'case': 'https://www.licbplus.com.dz/pc-components/case',
        'cooling': 'https://www.licbplus.com.dz/pc-components/cooling',
        'fans': 'https://www.licbplus.com.dz/pc-components/fans',
        'keyboard': 'https://www.licbplus.com.dz/accessoires/keyboard',
        'mouse': 'https://www.licbplus.com.dz/accessoires/mouse',
        'headset': 'https://www.licbplus.com.dz/accessoires/headset',
    }

    SELECTORS = {
        'product_card': 'div.product-cart-wrap',
        'name': 'h2 a.designation-truncate',
        'price': 'div.product-price span',
        'price_old': 'div.product-price span.old-price',
        'image': 'img',
        'badge': 'span.bac-inline-badge',
    }

    def __init__(self, delay: tuple = (1, 2)):
        super().__init__('licbplus', 'https://www.licbplus.com.dz', delay)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
        })

    def _fetch(self, url: str) -> str:
        for attempt in range(3):
            try:
                self._sleep()
                resp = self.session.get(url, timeout=15)
                resp.raise_for_status()
                return resp.text
            except Exception as e:
                print(f"    [!] Attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    raise
        return ''

    def _parse_page(self, html: str, category: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'html.parser')
        products = []
        cards = soup.select(self.SELECTORS['product_card'])
        print(f"    Found {len(cards)} product cards")

        for card in cards:
            try:
                name_el = card.select_one(self.SELECTORS['name'])
                if not name_el:
                    continue
                # Remove stock status badge from name if present
                for badge in name_el.select('span.stock-status'):
                    badge.decompose()
                name = name_el.get_text(strip=True)

                price_el = card.select_one(self.SELECTORS['price'])
                price = price_el.get_text(strip=True) if price_el else ''

                old_price_el = card.select_one(self.SELECTORS['price_old'])
                old_price = old_price_el.get_text(strip=True) if old_price_el else None

                img_el = card.select_one(self.SELECTORS['image'])
                image = img_el.get('src', '') if img_el else ''
                if not image and img_el:
                    image = img_el.get('data-src', '')

                link = name_el.get('href', '')
                if link and not link.startswith('http'):
                    link = self.base_url + link

                product = {
                    'name': name,
                    'price': price,
                    'old_price': old_price,
                    'availability': 'In stock',
                    'url': link,
                    'image': image,
                    'site': 'licbplus.com.dz',
                    'retailer_name': 'LICB Plus',
                    'scraped_at': __import__('datetime').datetime.utcnow().isoformat(),
                }

                if name and price and self.normalize_price(price):
                    products.append(product)

            except Exception as e:
                print(f"    [!] Parse error: {e}")
                continue

        return products

    def scrape_category(self, category_url: str, category_name: str) -> List[Dict]:
        print(f"[+] Scraping {category_name}: {category_url}")
        all_products = []

        html = self._fetch(category_url)
        products = self._parse_page(html, category_name)
        all_products.extend(products)
        print(f"    Page 1: {len(products)} products")

        for page in range(2, 10):
            page_url = f"{category_url}?page={page}"
            try:
                html = self._fetch(page_url)
                products = self._parse_page(html, category_name)
                if not products:
                    break
                all_products.extend(products)
                print(f"    Page {page}: {len(products)} products")
            except Exception as e:
                print(f"    [!] Page {page} error: {e}")
                break

        print(f"[+] {category_name}: {len(all_products)} total")
        return all_products

    def scrape_all(self, categories: List[str] = None) -> List[Dict]:
        all_products = []
        cats = list(categories) if categories else list(self.CATEGORIES.keys())

        for cat in cats:
            url = self.CATEGORIES.get(cat)
            if not url:
                continue
            try:
                products = self.scrape_category(url, cat)
                all_products.extend(products)
            except Exception as e:
                print(f"[!] Failed to scrape {cat}: {e}")

        print(f"\n[+] LICB Plus: {len(all_products)} products scraped total")
        return all_products
