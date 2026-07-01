#!/usr/bin/env python3
"""Quick adapter to merge fresh Ouedkniss with existing non-Ouedkniss data."""
import json
import sys
from datetime import datetime
from pathlib import Path

# Paths
project_root = Path(__file__).parent.parent
scraper_dir = project_root / 'scripts' / 'pc-parts-scraper'
sys.path.insert(0, str(scraper_dir))

from categorizer import clean_all

OUEDKNISS_NAMES = {
    'ouedkniss', 'admin informatique', 'it device', 'v2 tech', 'kpc solutions',
    'br informatique', 'hiprospace', 'microsoft pro dz', 'informatics',
    'best buy dz', 'tech mania', 'orbitech', 'gamingzone by divatech', 'pc pro dz',
    'future city informatique', 'khalil technologie', 'g2t informatique',
}

def is_ouedkniss(source):
    return source.strip().lower() in OUEDKNISS_NAMES

def main():
    clean_products_path = project_root / 'public' / 'clean-products.json'
    ouedkniss_raw_path = project_root / 'scripts' / 'ouedkniss-raw.json'
    server_data_path = project_root / 'server' / 'data' / 'clean-products.json'

    # 0. Load fresh Ouedkniss
    print("[0/3] Loading fresh Ouedkniss data...")
    ouedkniss_raw = []
    with open(ouedkniss_raw_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for p in data.get('products', []):
        try:
            price_str = p.get('price', '').replace(',', '').replace(' DA', '').strip()
            price = int(price_str) if price_str else 0
            old_price_str = (p.get('old_price') or '').replace(',', '').replace(' DA', '').strip()
            old_price = int(old_price_str) if old_price_str else None
            ouedkniss_raw.append({
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
    print(f"  [+] Loaded {len(ouedkniss_raw)} fresh Ouedkniss products")

    # 1. Load existing non-Ouedkniss
    print("\n[1/3] Loading existing clean-products...")
    with open(clean_products_path, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    existing_products = existing.get('products', [])
    non_oued = [p for p in existing_products if not any(is_ouedkniss(l.get('source', '')) for l in p.get('listings', []))]
    print(f"  [+] Existing: {len(existing_products)} products")
    print(f"  [+] Non-Ouedkniss kept: {len(non_oued)} products")

    # 2. Clean fresh Ouedkniss
    print("\n[2/3] Cleaning fresh Ouedkniss...")
    cleaned = clean_all(ouedkniss_raw)
    print(f"  [+] Cleaned: {len(cleaned)} products")

    # Category breakdown
    cats = {}
    for p in cleaned:
        c = p.get('category', 'unknown')
        cats[c] = cats.get(c, 0) + 1
    print(f"  [+] Categories:")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"      {c:15s}: {n:4d}")

    # 3. Convert to frontend
    print("\n[3/3] Converting to frontend format...")
    groups = {}
    for p in cleaned:
        key = p.get('model_key', '') or p['name'].lower().replace(' ', '-')[:40]
        cat = p.get('category', 'unknown')
        group_key = f"{cat}::{key}"
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(p)

    oued_frontend = []
    for group_key, items in groups.items():
        if not items:
            continue
        first = items[0]
        prices = [p['price'] for p in items if p.get('price', 0) > 0]
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
        oued_frontend.append({
            'id': f"prd-{group_key.replace('::', '-').replace('/', '-')[:40]}-{datetime.now().strftime('%H%M')}",
            'name': first['name'].strip(),
            'canonicalName': first['name'].strip(),
            'brand': first.get('brand') if first.get('brand') != 'Unknown' else None,
            'category': first.get('category', 'pc_part') if first.get('category', 'unknown') != 'unknown' else 'pc_part',
            'specs': first.get('specs', {}),
            'imageUrl': first.get('image', '') or None,
            'bestPrice': min(prices) if prices else 0,
            'worstPrice': max(prices) if prices else 0,
            'averagePrice': round(sum(prices) / len(prices)) if prices else 0,
            'listingCount': len(listings),
            'storeCount': len(set(l['source'] for l in listings)),
            'listings': sorted(listings, key=lambda x: x['price']),
        })

    oued_frontend.sort(key=lambda x: x['listingCount'], reverse=True)
    print(f"  [+] Fresh Ouedkniss frontend: {len(oued_frontend)} products")

    # 4. Merge with existing non-Ouedkniss
    print("\n[4/3] Merging with existing non-Ouedkniss...")
    existing = set(p.get('name', '').strip().lower() for p in non_oued)
    merged = list(non_oued)
    added = 0
    for p in oued_frontend:
        name = p.get('name', '').strip().lower()
        if name and name not in existing:
            merged.append(p)
            existing.add(name)
            added += 1
    print(f"  [+] Merged: {added} new Ouedkniss products")
    print(f"  [+] Total merged: {len(merged)} products")

    # 5. Save
    print("\n[5/3] Saving...")
    oued_count = sum(1 for p in merged if any(is_ouedkniss(l.get('source', '')) for l in p.get('listings', [])))
    output = {
        'timestamp': datetime.now().isoformat(),
        'total': len(merged),
        'stats': {
            'originalCount': len(ouedkniss_raw),
            'cleanCount': len(cleaned),
            'uniqueCount': len(oued_frontend),
            'mergedTotal': len(merged),
            'ouedknissCount': oued_count,
            'nonOuedCount': len(merged) - oued_count,
        },
        'products': merged,
    }
    for p in [clean_products_path, server_data_path]:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"  [+] {p}")

    print(f"\n{'='*60}")
    print(f"  DONE: {len(merged)} products ({oued_count} Ouedkniss, {len(merged)-oued_count} other)")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
