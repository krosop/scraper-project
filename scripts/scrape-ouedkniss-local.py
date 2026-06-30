#!/usr/bin/env python3
"""
Ouedkniss Local Scraper — runs on your local machine (not GitHub Actions).
Ouedkniss API blocks GitHub Actions IPs, so this must be run locally.

Usage:
    python scripts/scrape-ouedkniss-local.py

Prerequisites:
    pip install requests
    (No Playwright needed — uses direct API calls)

After running, commit the output and push:
    git add public/clean-products.json public/data/products.json
    git commit -m "data: update Ouedkniss products"
    git push
"""
import json
import requests
import time
import random
import re
from datetime import datetime, timezone
from pathlib import Path

GRAPHQL_URL = 'https://api.ouedkniss.com/graphql'
BASE_URL = 'https://www.ouedkniss.com'

STORES = {
    '1059': 'Admin Informatique',
    '17937': 'IT Device',
    '19409': 'V2 Tech',
    '20744': 'BR Informatique',
    '17356': 'Hiprospace',
    '18611': 'Microsoft Pro DZ',
    '12489': 'Informatics',
    '5975': 'PC Pro DZ',
    '36761': 'Orbitech',
    '31810': 'KPC Solutions',
    '34384': 'Tech Mania',
    '38815': 'GamingZone by Divatech',
    '39421': 'Best Buy DZ',
    '30409': 'Future City Informatique',
    '31499': 'Khalil Technologie',
    '27096': 'G2T Informatique',
}


def fetch_page(session, category_slug, page=1, store_id=None, max_retries=3):
    """Fetch a page of announcements via GraphQL."""
    time.sleep(random.uniform(0.3, 0.8))
    
    filter_fields = f'categorySlug: "{category_slug}", page: {page}, orderByField: {{field: REFRESHED_AT}}, count: 48'
    if store_id:
        filter_fields += f', storeId: "{store_id}"'
    
    query = f'''
query {{
  search(q: null, filter: {{{filter_fields}}}) {{
    announcements {{
      data {{
        id
        title
        slug
        price
        oldPrice
        defaultMedia {{
          mediaUrl
          thumbnail
        }}
        store {{
          name
        }}
        status
      }}
      paginatorInfo {{
        lastPage
        hasMorePages
        total
      }}
    }}
  }}
}}'''
    
    payload = {'query': query}
    
    for attempt in range(max_retries):
        try:
            resp = session.post(GRAPHQL_URL, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if 'data' not in data or data.get('data') is None:
                if 'errors' in data:
                    raise Exception(f"GraphQL errors: {data['errors']}")
                raise Exception("Missing data field")
            return data
        except Exception as e:
            wait = (2 ** attempt) + random.uniform(0, 1)
            print(f"    [!] Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait:.1f}s...")
            time.sleep(wait)
    
    raise Exception(f"All retries failed")


def parse_announcements(data):
    """Parse GraphQL response into product dicts."""
    products = []
    announcements = data.get('data', {}).get('search', {}).get('announcements', {}).get('data', [])
    
    for ann in announcements:
        try:
            title = ann.get('title', '').strip()
            if not title or len(title) < 3:
                continue
            
            lower = title.lower()
            if any(x in lower for x in ['voiture', 'appartement', 'maison', 'terrain', 'scooter', 'moto', 'phone', 'telephone', 'tablet', 'tablette', 'console', 'playstation', 'xbox', 'switch', 'camera', 'appareil photo', 'imprimante', 'printer', 'scanner', 'photocopieur', 'tv', 'television', 'smart tv', 'ecran tv', 'chargeur', 'cable', 'adaptateur', 'sac', 'sacoche', 'support', 'tapis', 'hub usb', 'carte sd', 'cle usb', 'antivirus', 'windows', 'office', 'logiciel', 'compte', 'abonnement', 'recharge', 'carte', 'modem', 'routeur', 'switch reseau', 'point d\'acces']):
                continue
            
            price_val = ann.get('price')
            price = f"{price_val:,.0f} DA" if price_val is not None and price_val > 0 else ''
            
            old_price = None
            old_price_val = ann.get('oldPrice')
            if old_price_val is not None and old_price_val != price_val and old_price_val > 0:
                old_price = f"{old_price_val:,.0f} DA"
            
            ann_id = ann.get('id', '')
            slug = ann.get('slug', '')
            url = f"{BASE_URL}/{slug}-d{ann_id}" if ann_id and slug else ''
            
            image = ''
            default_media = ann.get('defaultMedia')
            if default_media:
                image = default_media.get('mediaUrl') or default_media.get('thumbnail') or ''
            
            store = ann.get('store')
            retailer_name = store.get('name') if store else 'Ouedkniss'
            
            products.append({
                'name': title,
                'price': price,
                'old_price': old_price,
                'availability': 'In stock',
                'url': url,
                'image': image,
                'site': 'ouedkniss.com',
                'retailer_name': retailer_name,
                'sku': f"ouedkniss-{ann_id}",
                'scraped_at': datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            continue
    
    return products


def scrape_store(session, store_id, store_name):
    """Scrape all pages for a single store."""
    print(f"\n[+] Scraping {store_name} (store {store_id})...")
    all_products = []
    
    try:
        data = fetch_page(session, 'informatique', page=1, store_id=store_id)
        products = parse_announcements(data)
        all_products.extend(products)
        
        paginator = data.get('data', {}).get('search', {}).get('announcements', {}).get('paginatorInfo', {})
        last_page = paginator.get('lastPage', 1)
        total = paginator.get('total', len(products))
        print(f"    Page 1: {len(products)} products (API total: {total})")
        
        if last_page > 1:
            max_pages = min(last_page, 20)
            for page in range(2, max_pages + 1):
                try:
                    data = fetch_page(session, 'informatique', page=page, store_id=store_id)
                    products = parse_announcements(data)
                    if not products:
                        break
                    all_products.extend(products)
                    print(f"    Page {page}: {len(products)} products")
                except Exception as e:
                    print(f"    [!] Page {page} failed: {e}")
                    break
    except Exception as e:
        print(f"    [!] Failed: {e}")
    
    print(f"[+] {store_name}: {len(all_products)} products total")
    return all_products


def main():
    print("=" * 60)
    print("  Ouedkniss Local Scraper")
    print("  Run this on your local machine (not GitHub Actions)")
    print("=" * 60)
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.ouedkniss.com',
        'Referer': 'https://www.ouedkniss.com/',
    })
    
    all_products = []
    
    for store_id, store_name in STORES.items():
        products = scrape_store(session, store_id, store_name)
        all_products.extend(products)
        time.sleep(random.uniform(1, 2))
    
    print(f"\n{'=' * 60}")
    print(f"  TOTAL: {len(all_products)} products")
    print(f"{'=' * 60}")
    
    # Store breakdown
    store_counts = {}
    for p in all_products:
        s = p['retailer_name']
        store_counts[s] = store_counts.get(s, 0) + 1
    
    print("\nStore breakdown:")
    for s, c in sorted(store_counts.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")
    
    # Save
    output = {
        'timestamp': datetime.now().isoformat(),
        'total': len(all_products),
        'products': all_products,
    }
    
    out_path = Path('scripts/ouedkniss-raw.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n[+] Saved to {out_path}")
    print(f"\nNext steps:")
    print(f"  1. Run: python scripts/adapter_v2.py")
    print(f"  2. Run: node scripts/convert-data.js")
    print(f"  3. Commit and push the updated data files")


if __name__ == '__main__':
    main()
