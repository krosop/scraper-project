#!/usr/bin/env python3
"""
Ouedkniss Scraper — https://www.ouedkniss.com
Uses the public GraphQL API to fetch PC parts announcements.
Supports both general category scraping and store-specific scraping.

Robustness features:
- Fresh session per store (avoids IP flagging)
- Random User-Agent rotation
- 5s delay between requests, 10s between stores
- 5 retries with exponential backoff
- Longer timeout (30s)
- Detailed error logging with response body
"""
import sys
import requests
import json
import re
import random
import time
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

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
]


class OuedknissScraper:
    """Scraper for Ouedkniss — Algerian classifieds marketplace (GraphQL API)."""

    CATEGORIES = {
        'pc_part': 'informatique',
    }

    def __init__(self, delay: float = 5.0):
        self.delay = delay

    def _create_session(self) -> requests.Session:
        """Create a fresh session with random User-Agent."""
        session = requests.Session()
        session.headers.update({
            'User-Agent': random.choice(USER_AGENTS),
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://www.ouedkniss.com',
            'Referer': 'https://www.ouedkniss.com/',
            'X-Requested-With': 'XMLHttpRequest',
        })
        return session

    def _fetch_page(self, session: requests.Session, category_slug: str, page: int = 1, store_id: str = None, max_retries: int = 5) -> dict:
        """Fetch a page of announcements via GraphQL with retry."""
        time.sleep(random.uniform(2.0, self.delay))

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
                resp = session.post(GRAPHQL_URL, json=payload, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                
                # Verify response structure
                if 'data' not in data:
                    raise Exception(f"Missing 'data' field. Response: {json.dumps(data)[:500]}")
                if data.get('data') is None:
                    if 'errors' in data:
                        raise Exception(f"GraphQL errors: {json.dumps(data['errors'])[:500]}")
                    raise Exception("data is null")
                
                search_data = data.get('data', {}).get('search')
                if search_data is None:
                    raise Exception(f"Missing 'search' field. Response: {json.dumps(data)[:500]}")
                
                announcements = search_data.get('announcements')
                if announcements is None:
                    raise Exception(f"Missing 'announcements' field. Response: {json.dumps(data)[:500]}")
                
                return data
            except Exception as e:
                last_error = e
                wait = (2 ** attempt) * 2 + random.uniform(1, 3)
                print(f"    [!] Attempt {attempt + 1}/{max_retries} failed: {e}")
                print(f"    [i] Retrying in {wait:.1f}s...")
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
                if price_val is not None and price_val > 0:
                    price = f"{price_val:,.0f} DA"

                old_price = None
                old_price_val = ann.get('oldPrice')
                if old_price_val is not None and old_price_val != price_val and old_price_val > 0:
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

    def _scrape_store(self, category_slug: str, store_name: str, store_id: str) -> List[Dict]:
        """Scrape a single store with its own fresh session."""
        label = f"{store_name} (store {store_id})"
        print(f"[+] Ouedkniss scraping {label}")
        
        # Fresh session per store to avoid IP flagging
        session = self._create_session()
        all_products = []
        total = 0

        try:
            data = self._fetch_page(session, category_slug, page=1, store_id=store_id)
            products = self._parse_announcements(data)
            all_products.extend(products)
            print(f"    Page 1: {len(products)} products")

            # Pagination
            paginator = data.get('data', {}).get('search', {}).get('announcements', {}).get('paginatorInfo', {})
            last_page = paginator.get('lastPage', 1)
            has_more = paginator.get('hasMorePages', False)
            total = paginator.get('total', len(products))

            if last_page > 1 and has_more:
                max_pages = min(last_page + 1, 15)  # Cap at 15 pages per store
                for page in range(2, max_pages):
                    try:
                        data = self._fetch_page(session, category_slug, page=page, store_id=store_id)
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
        Scrape products. If stores dict provided, scrape each store individually
        with a fresh session and delay between stores.
        """
        all_products = []

        if stores:
            store_items = list(stores.items())
            for i, (store_id, store_name) in enumerate(store_items):
                try:
                    products = self._scrape_store('informatique', store_name, store_id)
                    all_products.extend(products)
                except Exception as e:
                    print(f"[!] Failed store {store_name} ({store_id}): {e}")
                
                # Long delay between stores to avoid rate limiting
                if i < len(store_items) - 1:
                    delay = random.uniform(8, 15)
                    print(f"    [i] Sleeping {delay:.1f}s before next store...")
                    time.sleep(delay)
        else:
            # Legacy: scrape general category with single session
            session = self._create_session()
            cats = categories or ['pc_part']
            for cat in cats:
                if cat not in self.CATEGORIES:
                    print(f"[!] Unknown: {cat}"); continue
                slug = self.CATEGORIES[cat]
                try:
                    data = self._fetch_page(session, slug, page=1)
                    products = self._parse_announcements(data)
                    all_products.extend(products)
                    print(f"    Page 1: {len(products)} products")
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
        store_name = OUEDKNISS_STORES.get(args.store_id, 'Unknown')
        products = scraper._scrape_store('informatique', store_name, args.store_id)
        print(f"Scraped {len(products)} products from {store_name}")
    elif args.stores:
        products = scraper.scrape_all(stores=OUEDKNISS_STORES)
        print(f"Scraped {len(products)} products from {len(OUEDKNISS_STORES)} stores")
    else:
        products = scraper.scrape_all()
        print(f"Scraped {len(products)} products")

    for p in products[:5]:
        print(f"  {p['name'][:80]} @ {p['price']} | {p['retailer_name']}")
