"""
Ouedkniss Scraper — https://www.ouedkniss.com
Uses the public GraphQL API to fetch PC parts announcements.
Supports both general category scraping and store-specific scraping.
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
query SearchQuery($q: String, $filter: SearchFilterInput) {
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
        defaultMedia {
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
        total
      }
    }
  }
}
'''

# New Ouedkniss stores to scrape (store_id -> store_name)
OUEDKNISS_STORES = {
    '36761': 'Orbitech',
    '31810': 'KPC Solutions',
    '19409': 'V2 Tech',
    '34384': 'Tech Mania',
    '5975':  'PC Pro DZ',
    '18611': 'Microsoft Pro DZ',
    '20744': 'BR Informatique',
    '38815': 'GamingZone by Divatech',
    '17356': 'Hiprospace',
    '1059':  'Admin Informatique',
    '12489': 'Informatics',
    '17937': 'IT Device',
    '39421': 'Best Buy DZ',
}


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

    def _fetch_page(self, category_slug: str, page: int = 1, store_id: str = None, max_retries: int = 3) -> dict:
        """Fetch a page of announcements via GraphQL with retry."""
        import time, random
        time.sleep(random.uniform(0.8, self.delay))

        filter_obj = {
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

        if store_id:
            filter_obj['storeId'] = store_id

        variables = {
            'q': None,
            'filter': filter_obj,
        }

        payload = {
            'operationName': 'SearchQuery',
            'variables': variables,
            'query': SEARCH_QUERY,
        }

        last_error = None
        for attempt in range(max_retries):
            try:
                resp = self.session.post(GRAPHQL_URL, json=payload, timeout=20)
                resp.raise_for_status()
                data = resp.json()
                # Verify response structure
                if 'data' not in data or data.get('data') is None:
                    if 'errors' in data:
                        raise Exception(f"GraphQL errors: {data['errors']}")
                    raise Exception("Invalid response: missing data field")
                return data
            except Exception as e:
                last_error = e
                wait = (2 ** attempt) + random.uniform(0, 1)
                print(f"    [!] Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait:.1f}s...")
                time.sleep(wait)
        
        raise Exception(f"All {max_retries} retries failed: {last_error}")

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

    def _scrape_category_or_store(self, category_slug: str, name: str, store_id: str = None) -> List[Dict]:
        """Scrape a category, optionally filtered by store."""
        label = f"{name} (store {store_id})" if store_id else name
        print(f"[+] Ouedkniss scraping {label}: {category_slug}")
        all_products = []

        try:
            data = self._fetch_page(category_slug, page=1, store_id=store_id)
            products = self._parse_announcements(data)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")

            # Pagination
            paginator = data.get('data', {}).get('search', {}).get('announcements', {}).get('paginatorInfo', {})
            last_page = paginator.get('lastPage', 1)
            has_more = paginator.get('hasMorePages', False)
            total = paginator.get('total', len(products))

            if last_page > 1 and has_more:
                # Use actual last_page from API, but cap at reasonable limit
                max_pages = min(last_page + 1, 30)
                for page in range(2, max_pages):
                    try:
                        data = self._fetch_page(category_slug, page=page, store_id=store_id)
                        products = self._parse_announcements(data)
                        if not products:
                            break
                        all_products.extend(products)
                        print(f"    Page {page}: {len(products)} products")
                    except Exception as e:
                        print(f"    Pagination stopped at page {page}: {e}")
                        break
        except Exception as e:
            print(f"    [!] Failed: {e}")

        print(f"[+] {label}: {len(all_products)} total (API reported {total})")
        return all_products

    def scrape_all(self, categories: list = None, stores: dict = None) -> List[Dict]:
        """
        Scrape products. If stores dict provided, scrape each store individually.
        Otherwise, scrape general category.
        """
        all_products = []

        # If stores are specified, scrape each store
        if stores:
            for store_id, store_name in stores.items():
                try:
                    products = self._scrape_category_or_store(
                        'informatique', store_name, store_id=store_id
                    )
                    all_products.extend(products)
                except Exception as e:
                    print(f"[!] Failed store {store_name} ({store_id}): {e}")
        else:
            # Legacy: scrape general category
            cats = categories or ['pc_part']
            for cat in cats:
                if cat not in self.CATEGORIES:
                    print(f"[!] Unknown: {cat}"); continue
                slug = self.CATEGORIES[cat]
                try:
                    products = self._scrape_category_or_store(slug, cat)
                    all_products.extend(products)
                except Exception as e:
                    print(f"[!] Failed {cat}: {e}")

        print(f"\n[+] Ouedkniss: {len(all_products)} products total")
        return all_products


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Ouedkniss scraper')
    parser.add_argument('--stores', action='store_true', help='Scrape specific stores instead of general category')
    parser.add_argument('--store-id', type=str, help='Scrape a single store by ID')
    args = parser.parse_args()

    scraper = OuedknissScraper()

    if args.store_id:
        # Scrape single store
        store_name = OUEDKNISS_STORES.get(args.store_id, 'Unknown')
        products = scraper._scrape_category_or_store('informatique', store_name, store_id=args.store_id)
        print(f"Scraped {len(products)} products from {store_name}")
    elif args.stores:
        # Scrape all configured stores
        products = scraper.scrape_all(stores=OUEDKNISS_STORES)
        print(f"Scraped {len(products)} products from {len(OUEDKNISS_STORES)} stores")
    else:
        # Legacy: scrape general category
        products = scraper.scrape_all()
        print(f"Scraped {len(products)} products")

    for p in products[:5]:
        print(f"  {p['name'][:80]} @ {p['price']} | {p['retailer_name']}")
