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
    
    raw_products = []
    sites = ['licbplus', 'gamingdz', 'geekzone', 'gigastore', 'lahlou', 'hardsoft', 'digitec', 'matos', 'ouedkniss']
    
    for site in sites:
        try:
            print(f"  Scraping {site}...")
            products = scrape_site(site)
            raw_products.extend(products)
            print(f"  [+] {site}: {len(products)} products")
        except Exception as e:
            print(f"  [!] {site} failed: {e}")
    
    print(f"\n[+] Total raw: {len(raw_products)} products")
    
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
