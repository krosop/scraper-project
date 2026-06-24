#!/usr/bin/env python3
"""
PC Parts Scraper — Main Runner
Orchestrates scraping from all sites, cleans data, builds comparisons, and saves output.
Usage:
    python run.py                      # Scrape all sites, all categories
    python run.py --sites licbplus     # Scrape only LICB Plus
    python run.py --sites wifidjelfa   # Scrape only WIFI Djelfa
    python run.py --cats cpu gpu       # Scrape only CPU and GPU categories
    python run.py --dry-run            # Process existing data without scraping
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# ─── Configuration ───
DATA_DIR = Path('data')
RAW_DIR = DATA_DIR / 'raw'
HISTORY_DIR = DATA_DIR / 'history'
OUTPUT_DIR = Path('docs') / 'data'


def ensure_dirs():
    for d in [DATA_DIR, RAW_DIR, HISTORY_DIR, OUTPUT_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def load_existing_data() -> list:
    """Load previously scraped data if available."""
    existing = []
    for f in sorted(RAW_DIR.glob('*.json'), reverse=True):
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
                if isinstance(data, list):
                    existing.extend(data)
                    print(f"[+] Loaded {len(data)} products from {f.name}")
        except Exception as e:
            print(f"[!] Failed to load {f}: {e}")
    return existing


def run_scraper(site_name: str, categories: list = None) -> list:
    """Run a specific scraper and return raw products."""
    if site_name == 'licbplus':
        from scraper.sites.licbplus import LicbplusScraper
        scraper = LicbplusScraper()
        return scraper.scrape_all(categories=categories)

    elif site_name == 'wifidjelfa':
        from scraper.sites.wifidjelfa import WifidjelfaScraper
        scraper = WifidjelfaScraper()
        return scraper.scrape_all(categories=categories)

    elif site_name == 'generic_sitemap':
        from scraper.sites.generic_sitemap import scrape_all_sites
        sitemap_path = Path(__file__).parent / 'sitemap.json'
        return scrape_all_sites(sitemap_path, max_pages=1, max_sites=None)

    else:
        print(f"[!] Unknown site: {site_name}")
        return []


def process_and_save(raw_products: list, args):
    """Clean data, build comparisons, and save all outputs."""
    from core.categorizer import clean_all, build_comparison_table

    print(f"\n{'='*60}")
    print(f"  PROCESSING {len(raw_products)} RAW PRODUCTS")
    print(f"{'='*60}\n")

    # Step 1: Clean all products
    cleaned = clean_all(raw_products)
    print(f"[+] Cleaned: {len(cleaned)} valid products")

    # Category breakdown
    cat_counts = {}
    for p in cleaned:
        cat = p.get('category', 'unknown')
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    print(f"[+] Categories:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"    {cat:15s}: {count:4d} products")

    # Step 2: Save cleaned products
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')

    # Main products file (for frontend)
    products_file = OUTPUT_DIR / 'products.json'
    with open(products_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)
    print(f"\n[+] Saved products.json ({len(cleaned)} items)")

    # Archive with timestamp
    archive_file = HISTORY_DIR / f'products_{timestamp}.json'
    with open(archive_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)

    # Step 3: Build comparison table
    print(f"\n[+] Building cross-retailer comparisons...")
    comparisons = build_comparison_table(cleaned)
    print(f"[+] Found {len(comparisons)} products at multiple retailers")

    if comparisons:
        comp_file = OUTPUT_DIR / 'comparisons.json'
        with open(comp_file, 'w', encoding='utf-8') as f:
            json.dump(comparisons, f, indent=2, ensure_ascii=False)
        print(f"[+] Saved comparisons.json")

        # Print top savings
        print(f"\n[+] Top price differences:")
        for comp in comparisons[:10]:
            print(f"    {comp['name'][:50]:50s} | Save {comp['savings']:>6,} DA | "
                  f"{comp['cheapest_retailer']} ({comp['cheapest_price']}) vs "
                  f"up to {comp['highest_price']}")

    # Step 4: Save stats
    prices = [p['price'] for p in cleaned if p.get('price', 0) > 0]
    stats = {
        'scraped_at': datetime.utcnow().isoformat(),
        'total_products': len(cleaned),
        'categories': cat_counts,
        'retailers': list(set(p.get('retailer_name', '') for p in cleaned)),
        'avg_price': round(sum(prices) / len(prices)) if prices else 0,
        'min_price': round(min(prices)) if prices else 0,
        'max_price': round(max(prices)) if prices else 0,
        'on_sale': sum(1 for p in cleaned if p.get('old_price')),
        'comparisons_found': len(comparisons),
        'top_savings': [
            {'name': c['name'][:60], 'savings': c['savings'],
             'cheapest': c['cheapest_price'], 'retailer': c['cheapest_retailer']}
            for c in comparisons[:5]
        ]
    }

    stats_file = OUTPUT_DIR / 'stats.json'
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved stats.json")

    # Step 5: Save by category (for frontend filtering)
    for cat in cat_counts:
        cat_products = [p for p in cleaned if p.get('category') == cat]
        cat_file = OUTPUT_DIR / f'{cat}.json'
        with open(cat_file, 'w', encoding='utf-8') as f:
            json.dump(cat_products, f, indent=2, ensure_ascii=False)

    return cleaned, comparisons, stats


def main():
    parser = argparse.ArgumentParser(description='PC Parts Scraper for Algerian retailers')
    parser.add_argument('--sites', nargs='+', choices=['licbplus', 'wifidjelfa', 'generic_sitemap', 'all'],
                        default=['all'], help='Sites to scrape')
    parser.add_argument('--cats', nargs='+', help='Specific categories to scrape')
    parser.add_argument('--dry-run', action='store_true', help='Process existing data without scraping')
    parser.add_argument('--no-browser', action='store_true', help='Skip browser-based scrapers')
    args = parser.parse_args()

    ensure_dirs()

    print("=" * 60)
    print("  PC PARTS SCRAPER — Algeria")
    print(f"  Started: {datetime.utcnow().isoformat()}")
    print("=" * 60)

    raw_products = []

    # ─── Scrape Phase ───
    if not args.dry_run:
        sites = ['licbplus', 'wifidjelfa'] if 'all' in args.sites else args.sites

        for site in sites:
            if site == 'wifidjelfa' and args.no_browser:
                print(f"[!] Skipping {site} (browser disabled)")
                continue

            try:
                print(f"\n{'─' * 50}")
                print(f"  SCRAPING: {site.upper()}")
                print(f"{'─' * 50}")
                products = run_scraper(site, categories=args.cats)
                raw_products.extend(products)

                # Save raw immediately (per-site)
                raw_file = RAW_DIR / f"{site}_{datetime.utcnow().strftime('%Y%m%d')}.json"
                with open(raw_file, 'w', encoding='utf-8') as f:
                    json.dump(products, f, indent=2, ensure_ascii=False)

            except Exception as e:
                print(f"[!] Scraper failed for {site}: {e}")
                continue

    # ─── Load existing if dry-run or scraper failed ───
    if not raw_products:
        print("\n[!] No new data scraped. Loading existing...")
        raw_products = load_existing_data()

    if not raw_products:
        print("[!] No data available. Exiting.")
        sys.exit(1)

    # ─── Process Phase ───
    cleaned, comparisons, stats = process_and_save(raw_products, args)

    # ─── Summary ───
    print(f"\n{'=' * 60}")
    print(f"  DONE — Summary:")
    print(f"    Products:   {stats['total_products']}")
    print(f"    Categories: {len(stats['categories'])}")
    print(f"    Retailers:  {', '.join(stats['retailers'])}")
    print(f"    Avg Price:  {stats['avg_price']:,} DA")
    print(f"    On Sale:    {stats['on_sale']}")
    print(f"    Multi-shop: {stats['comparisons_found']} products")
    print(f"    Output:     {OUTPUT_DIR}")
    print(f"{'=' * 60}\n")

    return cleaned, comparisons


if __name__ == '__main__':
    main()
