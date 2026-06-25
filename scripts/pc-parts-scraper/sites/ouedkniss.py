"""
Ouedkniss Scraper — https://www.ouedkniss.com
Uses the public GraphQL API to fetch PC parts announcements.
Only scrapes informatique (PC parts) category.
"""
import sys
import requests
import json
import re
from pathlib import Path
from typing import List, Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))


GRAPHQL_URL = 'https://api.ouedkniss.com/graphql'
BASE_URL = 'https://www.ouedkniss.com'

SEARCH_QUERY = '''
query SearchQuery($q: String, $filter: SearchFilterInput, $mediaSize: MediaSize = MEDIUM) {
  search(q: $q, filter: $filter) {
    announcements {
      data {
        id
        title
        slug
        description
        price
        pricePreview
        oldPrice
        oldPricePreview
        priceUnit
        priceType
        defaultMedia(size: $mediaSize) {
          mediaUrl
          thumbnail
        }
        medias(size: SMALL) {
          mediaUrl
          thumbnail
        }
        cities {
          name
        }
        store {
          name
          slug
          isVerified
        }
        category {
          id
          slug
        }
        refreshedAt
        status
      }
      paginatorInfo {
        lastPage
        hasMorePages
      }
    }
  }
}
'''


class OuedknissScraper:
    """Scraper for Ouedkniss — Algerian classifieds marketplace (GraphQL API)."""

    CATEGORIES = {
        'pc_part': 'informatique',
    }

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://www.ouedkniss.com',
            'Referer': 'https://www.ouedkniss.com/',
        })

    def _fetch_page(self, category_slug: str, page: int = 1) -> dict:
        """Fetch a page of announcements via GraphQL."""
        import time, random
        time.sleep(random.uniform(0.8, self.delay))

        variables = {
            'mediaSize': 'MEDIUM',
            'q': None,
            'filter': {
                'categorySlug': category_slug,
                'origin': None,
                'connected': False,
                'delivery': None,
                'regionIds': [],
                'cityIds': [],
                'priceRange': [],
                'exchange': None,
                'hasPictures': False,
                'hasPrice': False,
                'priceUnit': None,
                'fields': [],
                'page': page,
                'orderByField': {'field': 'REFRESHED_AT'},
                'count': 48,
            }
        }

        payload = {
            'operationName': 'SearchQuery',
            'variables': variables,
            'query': SEARCH_QUERY,
        }

        resp = self.session.post(GRAPHQL_URL, json=payload, timeout=20)
        resp.raise_for_status()
        return resp.json()

    def _parse_announcements(self, data: dict) -> List[Dict]:
        """Parse GraphQL response into product dicts."""
        products = []
        announcements = data.get('data', {}).get('search', {}).get('announcements', {}).get('data', [])

        for ann in announcements:
            try:
                title = ann.get('title', '').strip()
                if not title or len(title) < 3:
                    continue

                # Skip non-PC items (cars, apartments, etc.)
                lower = title.lower()
                if any(x in lower for x in ['voiture', 'appartement', 'maison', 'terrain', 'scooter', 'moto']):
                    continue

                # Price
                price_val = ann.get('price')
                price = ''
                if price_val is not None:
                    price = f"{price_val:,.0f} DA"

                old_price = None
                old_price_val = ann.get('oldPrice')
                if old_price_val is not None and old_price_val != price_val:
                    old_price = f"{old_price_val:,.0f} DA"

                # URL — Ouedkniss SPA format: /{slug}-d{id}/
                ann_id = ann.get('id', '')
                slug = ann.get('slug', '')
                url = f"{BASE_URL}/{slug}-d{ann_id}" if ann_id and slug else ''

                # Image — try defaultMedia first, then medias, then thumbnail
                image = ''
                default_media = ann.get('defaultMedia')
                if default_media:
                    image = default_media.get('mediaUrl') or default_media.get('thumbnail') or ''
                if not image:
                    medias = ann.get('medias', [])
                    if medias and len(medias) > 0:
                        image = medias[0].get('mediaUrl') or medias[0].get('thumbnail') or ''

                # Location
                location = 'Algeria'
                cities = ann.get('cities', [])
                if cities and len(cities) > 0:
                    location = cities[0].get('name', 'Algeria')

                # Store name
                store_name = 'Ouedkniss'
                store = ann.get('store')
                if store and store.get('name'):
                    store_name = store['name']

                availability = 'In stock'
                if ann.get('status') != 'PUBLISHED':
                    availability = 'Unavailable'

                products.append({
                    'name': title,
                    'price': price,
                    'old_price': old_price,
                    'availability': availability,
                    'url': url,
                    'image': image,
                    'site': 'ouedkniss.com',
                    'retailer_name': store_name,
                    'sku': f"ouedkniss-{ann_id}",
                    'scraped_at': datetime.utcnow().isoformat(),
                })
            except Exception:
                continue

        return products

    def scrape_category(self, category_slug: str, name: str) -> List[Dict]:
        print(f"[+] Ouedkniss scraping {name}: {category_slug}")
        all_products = []

        try:
            data = self._fetch_page(category_slug, page=1)
            products = self._parse_announcements(data)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")

            # Pagination
            paginator = data.get('data', {}).get('search', {}).get('announcements', {}).get('paginatorInfo', {})
            last_page = paginator.get('lastPage', 1)
            has_more = paginator.get('hasMorePages', False)

            if last_page > 1 and has_more:
                for page in range(2, min(last_page + 1, 10)):
                    try:
                        data = self._fetch_page(category_slug, page=page)
                        products = self._parse_announcements(data)
                        if not products:
                            break
                        all_products.extend(products)
                        print(f"    Page {page}: {len(products)} products")
                    except Exception as e:
                        print(f"    Pagination stopped: {e}")
                        break
        except Exception as e:
            print(f"    [!] Failed: {e}")

        print(f"[+] {name}: {len(all_products)} total")
        return all_products

    def scrape_all(self, categories: list = None) -> List[Dict]:
        # Only PC parts (informatique)
        cats = categories or ['pc_part']
        all_products = []
        for cat in cats:
            if cat not in self.CATEGORIES:
                print(f"[!] Unknown: {cat}"); continue
            slug = self.CATEGORIES[cat]
            try:
                products = self.scrape_category(slug, cat)
                all_products.extend(products)
            except Exception as e:
                print(f"[!] Failed {cat}: {e}")
        print(f"\n[+] Ouedkniss: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    scraper = OuedknissScraper()
    products = scraper.scrape_all()
    print(f"Scraped {len(products)} products")
    for p in products[:5]:
        print(f"  {p['name'][:80]} @ {p['price']}")
