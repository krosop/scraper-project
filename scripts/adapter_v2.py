#!/usr/bin/env python3
"""
Adapter for new scraper V2 — converts cleaned output to frontend format.
Does NOT require Supabase connection (just scrapes and saves JSON).
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add scraper path
SCRAPER_DIR = Path(__file__).parent / 'pc-parts-scraper'
sys.path.insert(0, str(SCRAPER_DIR))

from categorizer import clean_all


def convert_to_frontend(cleaned_products):
    """Convert new scraper cleaned products to frontend CleanProduct format."""
    
    # Group by model key for deduplication
    groups = {}
    for p in cleaned_products:
        key = p.get('model_key', '') or p['name'].lower().replace(' ', '-')[:40]
        cat = p.get('category', 'unknown')
        group_key = f"{cat}::{key}"
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(p)
    
    products = []
    for group_key, items in groups.items():
        if not items:
            continue
        
        first = items[0]
        prices = [p['price'] for p in items if p.get('price', 0) > 0]
        
        # Get unique listings by URL
        seen_urls = set()
        listings = []
        for p in items:
            url = p.get('url', '')
            if url in seen_urls or not url:
                continue
            seen_urls.add(url)
            listings.append({
                'source': p.get('retailer_name', p.get('site', 'Unknown')),
                'price': p.get('price', 0),
                'old_price': p.get('old_price') or 0,
                'condition': p.get('condition', 'new'),
                'location': 'Algeria',
                'url': url,
                'imageUrl': p.get('image', '') or None,
            })
        
        if not listings or not prices:
            continue
        
        products.append({
            'id': f"prd-{group_key.replace('::', '-').replace('/', '-')[:40]}-{datetime.now().strftime('%H%M')}",
            'name': first['name'].strip(),
            'canonicalName': first['name'].strip(),
            'brand': first.get('brand') if first.get('brand') != 'Unknown' else None,
            'category': first.get('category', 'pc_part') if first.get('category') != 'unknown' else 'pc_part',
            'specs': first.get('specs', {}),
            'imageUrl': first.get('image', '') or None,
            'bestPrice': min(prices) if prices else 0,
            'worstPrice': max(prices) if prices else 0,
            'averagePrice': round(sum(prices) / len(prices)) if prices else 0,
            'listingCount': len(listings),
            'storeCount': len(set(l['source'] for l in listings)),
            'listings': sorted(listings, key=lambda x: x['price']),
        })
    
    # Sort by listing count (most popular first)
    products.sort(key=lambda x: x['listingCount'], reverse=True)
    return products


def main():
    print("=" * 60)
    print("  DEAL FINDER DZ — Scraper V2 Adapter")
    print("=" * 60)
    
    # Import and run the new scraper
    print("\n[1/3] Running new scraper V2...")
    from run import scrape_site, SCRAPER_MAP
    from sites.ouedkniss import OUEDKNISS_STORES
    
    raw_products = []
    sites = ['licbplus', 'gamingdz', 'geekzone', 'gigastore', 'lahlou', 'hardsoft', 'digitec', 'matos', 'ouedkniss']
    
    for site in sites:
        try:
            print(f"  Scraping {site}...")
            # Pass Ouedkniss stores for store-specific scraping
            if site == 'ouedkniss':
                products = scrape_site(site, stores=OUEDKNISS_STORES)
            else:
                products = scrape_site(site)
            raw_products.extend(products)
            print(f"  [+] {site}: {len(products)} products")
        except Exception as e:
            print(f"  [!] {site} failed: {e}")
    
    print(f"\n[+] Total raw: {len(raw_products)} products")
    
    # If Ouedkniss returned 0 products, try again with individual stores
    ouedkniss_count = sum(1 for p in raw_products if p.get('site') == 'ouedkniss.com')
    if ouedkniss_count == 0:
        print("\n[!] Ouedkniss returned 0 products. Retrying individual stores...")
        from sites.ouedkniss import OuedknissScraper
        scraper = OuedknissScraper()
        for store_id, store_name in OUEDKNISS_STORES.items():
            try:
                print(f"  Retrying {store_name} (store {store_id})...")
                products = scraper._scrape_category_or_store('informatique', store_name, store_id=store_id)
                raw_products.extend(products)
                print(f"  [+] {store_name}: {len(products)} products")
            except Exception as e:
                print(f"  [!] {store_name} failed: {e}")
        print(f"\n[+] After retry — total raw: {len(raw_products)} products")
        ouedkniss_count = sum(1 for p in raw_products if p.get('site') == 'ouedkniss.com')
    
    # Fallback: preserve Ouedkniss data from previous scrape if current scrape fails completely
    if ouedkniss_count == 0:
        print("\n[!] Ouedkniss still 0. Loading previous data as fallback...")
        project_root = SCRAPER_DIR.parent.parent
        fallback_paths = [
            project_root / 'public' / 'clean-products.json',
        ]
        for fp in fallback_paths:
            if fp.exists():
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        old_data = json.load(f)
                    old_oued = [p for p in old_data.get('products', []) 
                                if any(l.get('source', '').lower() in ['ouedkniss', 'admin informatique', 'it device', 'v2 tech', 'kpc solutions', 'br informatique', 'hiprospace', 'microsoft pro dz', 'informatics', 'best buy dz', 'tech mania', 'orbitech', 'gamingzone by divatech', 'pc pro dz'] 
                                       for l in p.get('listings', []))]
                    if old_oued:
                        # Convert old format back to raw format for re-cleaning
                        for p in old_oued:
                            for l in p.get('listings', []):
                                if l.get('source', '').lower() in ['ouedkniss', 'admin informatique', 'it device', 'v2 tech', 'kpc solutions', 'br informatique', 'hiprospace', 'microsoft pro dz', 'informatics', 'best buy dz', 'tech mania', 'orbitech', 'gamingzone by divatech', 'pc pro dz']:
                                    raw_products.append({
                                        'name': p.get('name', ''),
                                        'price': l.get('price', 0),
                                        'old_price': l.get('old_price', 0),
                                        'url': l.get('url', ''),
                                        'image': l.get('imageUrl', ''),
                                        'site': 'ouedkniss.com',
                                        'retailer_name': l.get('source', 'Ouedkniss'),
                                        'scraped_at': datetime.utcnow().isoformat(),
                                    })
                        print(f"  [+] Restored {len(old_oued)} old Ouedkniss products from {fp}")
                        break
                except Exception as e:
                    print(f"  [!] Failed to load fallback: {e}")
    
    # Clean
    print("\n[2/3] Cleaning...")
    cleaned = clean_all(raw_products)
    print(f"[+] Cleaned: {len(cleaned)} products")
    
    # Convert to frontend format
    print("\n[3/3] Converting to frontend format...")
    frontend_products = convert_to_frontend(cleaned)
    print(f"[+] Frontend products: {len(frontend_products)}")
    
    # Build output
    output = {
        'timestamp': datetime.now().isoformat(),
        'total': len(frontend_products),
        'stats': {
            'originalCount': len(raw_products),
            'cleanCount': len(cleaned),
            'uniqueCount': len(frontend_products),
            'reductionRate': f"{((len(raw_products) - len(frontend_products)) / len(raw_products) * 100):.1f}%" if raw_products else "0%",
        },
        'products': frontend_products,
    }
    
    # Save
    print("\n[4/4] Saving output...")
    project_root = SCRAPER_DIR.parent.parent
    paths = [
        project_root / 'public' / 'clean-products.json',
        project_root / 'server' / 'data' / 'clean-products.json',
    ]
    
    for p in paths:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"  [+] {p}")
    
    print(f"\n{'=' * 60}")
    print(f"  DONE: {len(frontend_products)} products")
    print(f"{'=' * 60}\n")


if __name__ == '__main__':
    main()
