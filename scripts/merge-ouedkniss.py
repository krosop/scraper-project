#!/usr/bin/env python3
"""
Merge script: loads existing clean-products.json, removes old Ouedkniss data,
cleans fresh Ouedkniss data through the SAME categorizer pipeline as non-Ouedkniss data,
and merges with existing non-Ouedkniss products.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Path setup so we can import categorizer and adapter_v2 ──
SCRIPTS_DIR = Path(__file__).parent
SCRAPER_DIR = SCRIPTS_DIR / 'pc-parts-scraper'
sys.path.insert(0, str(SCRAPER_DIR))
sys.path.insert(0, str(SCRIPTS_DIR))

from categorizer import clean_all
from adapter_v2 import convert_to_frontend

OUEDKNISS_NAMES = {
    'ouedkniss', 'admin informatique', 'it device', 'v2 tech', 'kpc solutions',
    'br informatique', 'hiprospace', 'microsoft pro dz', 'informatics',
    'best buy dz', 'tech mania', 'orbitech', 'gamingzone by divatech', 'pc pro dz',
}


def is_ouedkniss(source: str) -> bool:
    """Normalize whitespace before checking source against Ouedkniss retailer names."""
    normalized = re.sub(r'\s+', ' ', source).strip().lower()
    return normalized in OUEDKNISS_NAMES


def main():
    project_root = Path(__file__).parent.parent
    clean_path = project_root / 'public' / 'clean-products.json'
    oued_path = project_root / 'scripts' / 'ouedkniss-raw.json'
    
    print("[1/4] Loading existing clean-products.json...")
    with open(clean_path, 'r', encoding='utf-8') as f:
        clean_data = json.load(f)
    
    existing_products = clean_data.get('products', [])
    print(f"  [i] Loaded {len(existing_products)} existing products")
    
    # Remove old Ouedkniss products (keep non-Ouedkniss as-is — already processed)
    non_oued = [p for p in existing_products 
                if not any(is_ouedkniss(l.get('source', '')) for l in p.get('listings', []))]
    removed = len(existing_products) - len(non_oued)
    print(f"  [i] Removed {removed} old Ouedkniss products, kept {len(non_oued)} non-Ouedkniss")
    
    print("\n[2/4] Loading fresh Ouedkniss data...")
    with open(oued_path, 'r', encoding='utf-8') as f:
        oued_data = json.load(f)
    oued_raw = oued_data.get('products', [])
    print(f"  [+] Loaded {len(oued_raw)} raw Ouedkniss products")
    
    print("\n[3/4] Cleaning Ouedkniss data through categorizer pipeline...")
    # clean_all handles: price parsing, category detection, brand detection,
    # specs extraction, name cleaning, SKU deduplication
    oued_cleaned = clean_all(oued_raw)
    print(f"  [+] Cleaned to {len(oued_cleaned)} products")
    
    print("\n[4/4] Converting to frontend format and merging...")
    oued_frontend = convert_to_frontend(oued_cleaned)
    print(f"  [+] Converted to {len(oued_frontend)} frontend products")
    
    merged = non_oued + oued_frontend
    oued_count = sum(1 for p in merged if any(is_ouedkniss(l.get('source', '')) for l in p.get('listings', [])))
    print(f"\n[+] Final: {len(merged)} total ({oued_count} Ouedkniss, {len(merged) - oued_count} non-Ouedkniss)")
    
    output = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'total': len(merged),
        'stats': {
            'originalCount': len(oued_raw) + len(non_oued),
            'cleanCount': len(merged),
            'uniqueCount': len(merged),
            'ouedknissCount': oued_count,
            'nonOuedknissCount': len(merged) - oued_count,
        },
        'products': merged,
    }
    
    with open(clean_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n[+] Saved to {clean_path}")
    
    # Also save to server data dir
    server_path = project_root / 'server' / 'data' / 'clean-products.json'
    server_path.parent.mkdir(parents=True, exist_ok=True)
    with open(server_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved to {server_path}")


if __name__ == '__main__':
    main()
