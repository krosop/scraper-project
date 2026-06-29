#!/usr/bin/env python3
"""
Adapter for new scraper V2 — converts cleaned output to frontend format.
Does NOT require Supabase connection (just scrapes and saves JSON).

NOTE: Ouedkniss is scraped locally (not from GitHub Actions) because
Ouedkniss API blocks GitHub Actions runner IPs. Run the local scraper:

    python scripts/scrape-ouedkniss-local.py

Then run this adapter to merge everything together.
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


# ── Ouedkniss store names (for detecting Ouedkniss data) ──
OUEDKNISS_NAMES = {
    'ouedkniss', 'admin informatique', 'it device', 'v2 tech', 'kpc solutions',
    'br informatique', 'hiprospace', 'microsoft pro dz', 'informatics',
    'best buy dz', 'tech mania', 'orbitech', 'gamingzone by divatech', 'pc pro dz',
}


def is_ouedkniss(source: str) -> bool:
    return source.strip().lower() in OUEDKNISS_NAMES


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


def load_ouedkniss_raw(path: Path) -> list:
    """Load fresh Ouedkniss data from local scraper output."""
    if not path.exists():
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        products = data.get('products', [])
        # Convert to scraper raw format (name -> title)
        raw = []
        for p in products:
            try:
                # Parse price string like "77,000 DA" -> 77000
                price_str = p.get('price', '').replace(',', '').replace(' DA', '').strip()
                price = int(price_str) if price_str else 0
                old_price_str = (p.get('old_price') or '').replace(',', '').replace(' DA', '').strip()
                old_price = int(old_price_str) if old_price_str else None
                raw.append({
                    'title': p.get('name', ''),
                    'price': price,
                    'old_price': old_price,
                    'url': p.get('url', ''),
                    'image': p.get('image', ''),
                    'site': p.get('site', 'ouedkniss.com'),
                    'retailer_name': p.get('retailer_name', 'Ouedkniss'),
                    'sku': p.get('sku', ''),
                })
            except Exception:
                continue
        print(f"  [+] Loaded {len(raw)} fresh Ouedkniss products from local scraper")
        return raw
    except Exception as e:
        print(f"  [!] Failed to load fresh Ouedkniss data: {e}")
        return []


def load_previous_ouedkniss(path: Path) -> list:
    """Load Ouedkniss products from existing clean-products.json."""
    if not path.exists():
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        old_products = data.get('products', [])
        oued_products = []
        for p in old_products:
            has_oued = any(is_ouedkniss(l.get('source', '')) for l in p.get('listings', []))
            if has_oued:
                oued_products.append(p)
        print(f"  [i] Loaded {len(oued_products)} Ouedkniss products from existing data")
        return oued_products
    except Exception as e:
        print(f"  [!] Failed to load previous Ouedkniss data: {e}")
        return []


def merge_ouedkniss(new_products: list, oued_products: list) -> list:
    """Merge Ouedkniss products into new products. Only add products that don't exist."""
    # Build set of existing product names (canonicalized)
    existing_names = set()
    for p in new_products:
        existing_names.add(p.get('name', '').strip().lower())
    
    merged = list(new_products)
    added = 0
    for p in oued_products:
        name = p.get('name', '').strip().lower()
        if name and name not in existing_names:
            merged.append(p)
            added += 1
    
    if added > 0:
        print(f"  [+] Merged {added} Ouedkniss products")
    return merged


def main():
    print("=" * 60)
    print("  DEAL FINDER DZ — Scraper V2 Adapter")
    print("  (Ouedkniss is scraped locally, not from GitHub Actions)")
    print("=" * 60)
    
    project_root = SCRAPER_DIR.parent.parent
    clean_products_path = project_root / 'public' / 'clean-products.json'
    ouedkniss_raw_path = project_root / 'scripts' / 'ouedkniss-raw.json'
    
    # ── 0. Load fresh Ouedkniss data from local scraper ──
    print("\n[0/4] Loading fresh Ouedkniss data...")
    ouedkniss_raw = load_ouedkniss_raw(ouedkniss_raw_path)
    
    # ── 1. Scrape (8 non-Ouedkniss stores) ──
    print("\n[1/4] Running scraper for 8 non-Ouedkniss stores...")
    from run import scrape_site, SCRAPER_MAP
    
    raw_products = []
    sites = ['licbplus', 'gamingdz', 'geekzone', 'gigastore', 'lahlou', 'digitec']
    
    for site in sites:
        try:
            print(f"  Scraping {site}...")
            products = scrape_site(site)
            raw_products.extend(products)
            print(f"  [+] {site}: {len(products)} products")
        except Exception as e:
            print(f"  [!] {site} failed: {e}")
    
    print(f"\n[+] Total raw (non-Ouedkniss): {len(raw_products)} products")
    
    # Add fresh Ouedkniss raw data
    if ouedkniss_raw:
        raw_products.extend(ouedkniss_raw)
        print(f"[+] Added {len(ouedkniss_raw)} fresh Ouedkniss products")
        print(f"[+] Total raw (all): {len(raw_products)} products")
    
    # ── 2. Clean ──
    print("\n[2/4] Cleaning...")
    cleaned = clean_all(raw_products)
    print(f"[+] Cleaned: {len(cleaned)} products")
    
    # ── 3. Convert to frontend format ──
    print("\n[3/4] Converting to frontend format...")
    frontend_products = convert_to_frontend(cleaned)
    print(f"[+] Frontend products: {len(frontend_products)}")
    
    # ── 4. Save ──
    print("\n[4/4] Saving output...")
    oued_count = sum(1 for p in frontend_products if any(is_ouedkniss(l.get('source', '')) for l in p.get('listings', [])))
    output = {
        'timestamp': datetime.now().isoformat(),
        'total': len(frontend_products),
        'stats': {
            'originalCount': len(raw_products),
            'cleanCount': len(cleaned),
            'uniqueCount': len(frontend_products),
            'ouedknissCount': oued_count,
            'reductionRate': f"{((len(raw_products) - len(frontend_products)) / len(raw_products) * 100):.1f}%" if raw_products else "0%",
        },
        'products': frontend_products,
    }
    
    paths = [
        clean_products_path,
        project_root / 'server' / 'data' / 'clean-products.json',
    ]
    
    for p in paths:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"  [+] {p}")
    
    print(f"\n{'=' * 60}")
    print(f"  DONE: {len(frontend_products)} products ({oued_count} Ouedkniss)")
    print(f"{'=' * 60}\n")


if __name__ == '__main__':
    main()
