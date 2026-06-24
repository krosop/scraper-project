#!/usr/bin/env python3
"""
PC Parts Scraper — Deal Finder DZ Integration Adapter

This script:
1. Runs the Python scraper (licbplus + wifidjelfa)
2. Converts its output to our clean-products.json format
3. Copies to public/ and server/data/
4. Uploads to Supabase

Usage:
    python scripts/pc-parts-scraper/adapter.py
"""
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# Add scraper path
SCRAPER_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRAPER_DIR))

from core.categorizer import clean_all, build_comparison_table
from core.models import PCPart, ProductMatch


def convert_to_frontend_format(python_products):
    """Convert Python PCPart objects to our frontend CleanProduct format."""
    
    # Group by model identifier (same product across stores)
    groups = {}
    for p in python_products:
        key = f"{p.get('category', 'unknown')}::{p.get('name', '').lower().replace(' ', '-')[:40]}"
        if key not in groups:
            groups[key] = []
        groups[key].append(p)
    
    products = []
    for key, items in groups.items():
        if not items:
            continue
        
        first = items[0]
        prices = [p['price'] for p in items if p.get('price', 0) > 0]
        
        # Get unique listings
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
                'condition': p.get('condition', 'new'),
                'location': 'Algeria',
                'url': url,
                'imageUrl': p.get('image', '') or None,
            })
        
        if not listings or not prices:
            continue
        
        products.append({
            'id': f"prd-{key.replace('::', '-').replace('/', '-')[:40]}-{datetime.now().strftime('%H%M')}",
            'canonicalName': first.get('name', '').strip(),
            'brand': first.get('brand', 'Unknown') if first.get('brand') != 'Unknown' else None,
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


def upload_to_supabase(products):
    """Upload cleaned products to Supabase."""
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("[!] Supabase env vars not set, skipping upload")
        return 0
    
    try:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
    except ImportError:
        print("[!] supabase-py not installed, skipping upload")
        return 0
    
    inserted = 0
    for product in products:
        try:
            # Upsert product
            prod_res = supabase.table('products').upsert({
                'canonical_name': product['canonicalName'],
                'category': product['category'],
                'brand': product['brand'],
                'model': product['specs'].get('gpu') or product['specs'].get('cpu') or product['specs'].get('chipset'),
                'specs': product['specs'],
                'store_image_url': product['imageUrl'],
            }, on_conflict='canonical_name').execute()
            
            if not prod_res.data:
                continue
            
            product_id = prod_res.data[0]['id']
            
            # Upsert listings
            for listing in product['listings']:
                # Find source
                source_res = supabase.table('sources').select('id').eq('name', listing['source']).limit(1).execute()
                if not source_res.data:
                    continue
                source_id = source_res.data[0]['id']
                
                supabase.table('listings').upsert({
                    'product_id': product_id,
                    'source_id': source_id,
                    'title': product['canonicalName'],
                    'price': listing['price'],
                    'condition': listing['condition'],
                    'location': listing['location'],
                    'url': listing['url'],
                    'image_url': listing['imageUrl'],
                    'is_available': True,
                    'status': 'fresh',
                    'scraped_at': datetime.now().isoformat(),
                    'expires_at': datetime.now().isoformat(),  # Will be updated by cleanup script
                }, on_conflict='product_id,source_id,url').execute()
            
            inserted += 1
        except Exception as e:
            print(f"  [!] Failed: {product['canonicalName']}: {e}")
    
    print(f"\n[+] Uploaded {inserted}/{len(products)} products to Supabase")
    return inserted


def main():
    print("=" * 60)
    print("  DEAL FINDER DZ — Python Scraper Integration")
    print("=" * 60)
    
    # Step 1: Run Python scraper
    print("\n[1/4] Running Python scraper...")
    from run import ensure_dirs, run_scraper
    
    ensure_dirs()
    
    raw_products = []
    sites = ['licbplus', 'generic_sitemap', 'wifidjelfa']
    
    for site in sites:
        try:
            print(f"\n  Scraping {site}...")
            products = run_scraper(site)
            raw_products.extend(products)
            print(f"  [+] {site}: {len(products)} products")
        except ImportError as e:
            print(f"  [!] {site} skipped: {e}")
        except Exception as e:
            print(f"  [!] {site} failed: {e}")
    
    print(f"\n[+] Total raw: {len(raw_products)} products")
    
    # Step 2: Clean with Python engine
    print("\n[2/4] Cleaning with Python categorizer...")
    cleaned = clean_all(raw_products)
    print(f"[+] Cleaned: {len(cleaned)} products")
    
    # Step 3: Convert to frontend format
    print("\n[3/4] Converting to frontend format...")
    frontend_products = convert_to_frontend_format(cleaned)
    print(f"[+] Converted: {len(frontend_products)} unique products")
    
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
    
    # Step 4: Save files
    print("\n[4/4] Saving output...")
    
    # Python scraper output
    scraper_output = SCRAPER_DIR / 'docs' / 'data' / 'products.json'
    scraper_output.parent.mkdir(parents=True, exist_ok=True)
    with open(scraper_output, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)
    print(f"  [+] Python scraper output: {scraper_output}")
    
    # Frontend format
    project_root = SCRAPER_DIR.parent.parent
    paths = [
        project_root / 'public' / 'clean-products.json',
        project_root / 'server' / 'data' / 'clean-products.json',
        SCRAPER_DIR / 'clean-products.json',
    ]
    
    for p in paths:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"  [+] {p}")
    
    # Step 5: Upload to Supabase
    print("\n[+] Uploading to Supabase...")
    upload_to_supabase(frontend_products)
    
    print(f"\n{'=' * 60}")
    print(f"  DONE: {len(frontend_products)} products")
    print(f"{'=' * 60}\n")


if __name__ == '__main__':
    main()
