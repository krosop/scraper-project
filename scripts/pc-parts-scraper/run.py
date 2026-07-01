#!/usr/bin/env python3
"""
PC Parts Scraper — Main Runner for 11 Algerian retailers + 13 Ouedkniss stores
Scrapes all sites, cleans data, pushes to Supabase.

Usage:
    python run.py                              # Scrape all sites
    python run.py --sites ouedkniss            # Only Ouedkniss stores
    python run.py --sites licbplus tiza        # Only specific sites
    python run.py --cats cpu                   # Category filter
    python run.py --dry-run                    # Process existing data

Sites: licbplus, wifidjelfa, tiza, geekzone, digitec, gigastore, gamingdz, lahlou, hardsoft, matos, ouedkniss
"""
import argparse
import sys
import json
import concurrent.futures
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from categorizer import clean_all

# Lazy import Supabase to avoid loading it when just scraping
def _get_supabase_client():
    from supabase_client import upsert_products_batch, test_connection
    return upsert_products_batch, test_connection

from sites.ouedkniss import OUEDKNISS_STORES

# All available scrapers
SCRAPER_MAP = {
    'licbplus': 'sites.licbplus.LicbplusScraper',
    'wifidjelfa': 'sites.wifidjelfa.WifidjelfaScraper',
    'tiza': 'sites.tiza.TizaScraper',
    'geekzone': 'sites.geekzone.GeekZoneScraper',
    'digitec': 'sites.digitec.DigitecScraper',
    'gigastore': 'sites.gigastore.GigastoreScraper',
    'gamingdz': 'sites.gamingdz.GamingDZScraper',
    'lahlou': 'sites.lahlou.LahlouScraper',
    'hardsoft': 'sites.hardsoft.HardSoftScraper',
    'matos': 'sites.matos.MatosScraper',
    'ouedkniss': 'sites.ouedkniss.OuedknissScraper',
}


def load_scraper(site_name: str):
    """Dynamically load a scraper class by name."""
    module_path, class_name = SCRAPER_MAP[site_name].rsplit('.', 1)
    module = __import__(module_path, fromlist=[class_name])
    return getattr(module, class_name)


def _scrape(site_name: str, categories: list = None, stores: dict = None) -> list:
    """Internal scrape function to run in a thread."""
    ScraperClass = load_scraper(site_name)
    scraper = ScraperClass()
    if site_name == 'ouedkniss' and stores:
        return scraper.scrape_all(stores=stores)
    return scraper.scrape_all(categories=categories)


def scrape_site(site_name: str, categories: list = None, stores: dict = None, timeout: int = 120) -> list:
    """Run a scraper with timeout and return raw products."""
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_scrape, site_name, categories, stores)
            return future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        print(f"[!] {site_name}: Timed out after {timeout}s")
        return []
    except ImportError as e:
        print(f"[!] {site_name}: Missing dependency — {e}")
        return []
    except Exception as e:
        print(f"[!] {site_name} scraper failed: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description='PC Parts Scraper — 9 Algerian retailers')
    parser.add_argument('--sites', nargs='+',
                        choices=list(SCRAPER_MAP.keys()) + ['all'],
                        default=['all'],
                        help='Sites to scrape (default: all)')
    parser.add_argument('--cats', nargs='+',
                        help='Categories: cpu, gpu, ram, monitor, storage, motherboard, psu, case, cooling, keyboard, mouse, headset')
    parser.add_argument('--dry-run', action='store_true', help='Skip scraping, process existing data')
    parser.add_argument('--no-browser', action='store_true', help='Skip browser-based scrapers (wifidjelfa, gamingdz)')
    parser.add_argument('--save-raw', action='store_true', help='Save raw data to JSON before cleaning')
    args = parser.parse_args()

    print("=" * 65)
    print("  PC PARTS SCRAPER — Algeria (9 retailers)")
    print(f"  Started: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 65)
    print()
    print("  Sites: licbplus, wifidjelfa, tiza, geekzone, digitec,")
    print("         gigastore, gamingdz, lahlou, hardsoft, matos,")
    print("         ouedkniss (13 stores)")
    print()

    # Determine sites to scrape
    sites = list(SCRAPER_MAP.keys()) if 'all' in args.sites else args.sites

    if args.no_browser:
        browser_sites = {'wifidjelfa', 'gamingdz'}
        sites = [s for s in sites if s not in browser_sites]
        print(f"  [i] Browser scrapers disabled. Sites: {', '.join(sites)}")
        print()

    # ─── Test Supabase ───
    print("[1] Testing Supabase connection...")
    _, test_connection = _get_supabase_client()
    if not test_connection():
        print("[!] Supabase not connected. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")
        sys.exit(1)
    print()

    # ─── Scrape Phase ───
    raw_products = []

    if not args.dry_run:
        for site in sites:
            print(f"{'─' * 55}")
            print(f"  SCRAPING: {site.upper()}")
            print(f"{'─' * 55}")
            products = scrape_site(site, categories=args.cats, stores=OUEDKNISS_STORES if site == 'ouedkniss' else None)
            raw_products.extend(products)

            if args.save_raw and products:
                raw_dir = Path('data/raw')
                raw_dir.mkdir(parents=True, exist_ok=True)
                raw_file = raw_dir / f"{site}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                with open(raw_file, 'w', encoding='utf-8') as f:
                    json.dump(products, f, indent=2, ensure_ascii=False)
                print(f"  [+] Saved raw: {raw_file}")
            print()

    if not raw_products:
        print("[!] No products scraped. Exiting.")
        sys.exit(1)

    # ─── Clean Phase ───
    print(f"[2] Cleaning {len(raw_products)} raw products...")
    cleaned = clean_all(raw_products)
    print(f"[+] Cleaned: {len(cleaned)} valid products")

    # Category breakdown
    cats = {}
    for p in cleaned:
        c = p.get('category', 'unknown')
        cats[c] = cats.get(c, 0) + 1
    print(f"[+] Categories:")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {c:15s}: {n:4d}")

    # Retailer breakdown
    rets = {}
    for p in cleaned:
        r = p.get('retailer_name', 'unknown')
        rets[r] = rets.get(r, 0) + 1
    print(f"[+] Retailers:")
    for r, n in sorted(rets.items(), key=lambda x: -x[1]):
        print(f"    {r:20s}: {n:4d}")
    print()

    # ─── Push to Supabase ───
    print(f"[3] Pushing {len(cleaned)} products to Supabase...")
    upsert_products_batch, _ = _get_supabase_client()
    stats = upsert_products_batch(cleaned)
    print(f"[+] Upserted: {stats['inserted']}, Failed: {stats['failed']}")
    print()

    # ─── Summary ───
    prices = [p['price'] for p in cleaned if p['price'] > 0]
    avg_price = sum(prices) // len(prices) if prices else 0
    on_sale = sum(1 for p in cleaned if p.get('old_price'))

    print(f"{'=' * 65}")
    print(f"  DONE — Summary")
    print(f"{'=' * 65}")
    print(f"    Total products:  {len(cleaned)}")
    print(f"    Categories:      {len(cats)}")
    print(f"    Retailers:       {len(rets)}")
    print(f"    Avg price:       {avg_price:,} DA")
    print(f"    On sale:         {on_sale}")
    print(f"    Price range:     {min(prices):,} - {max(prices):,} DA" if prices else "    No valid prices")
    print(f"{'=' * 65}")
    print()

    return cleaned


if __name__ == '__main__':
    main()
