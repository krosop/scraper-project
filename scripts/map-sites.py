"""
Site Mapper — Maps all Algerian PC store sites for the scraper pipeline.
Uses HTTP requests to discover category URLs, pagination patterns, and product structures.
Outputs sitemap JSON files for each store.
"""
import requests
from bs4 import BeautifulSoup
import json
import re
from urllib.parse import urljoin

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
}


def map_hardsoft():
    """Map HardSoft DZ — Custom PHP e-commerce."""
    base = 'https://hardsoft.dz'
    resp = requests.get(base, headers=HEADERS, timeout=20)
    soup = BeautifulSoup(resp.text, 'lxml')

    # PC parts categories (categorie.php?id=X)
    categories = {
        'processor': 'https://hardsoft.dz/categorie.php?id=4',
        'graphics-card': 'https://hardsoft.dz/categorie.php?id=19',
        'motherboard': 'https://hardsoft.dz/categorie.php?id=1',
        'ram': 'https://hardsoft.dz/categorie.php?id=26',
        'storage': 'https://hardsoft.dz/categorie.php?id=6',
        'psu': 'https://hardsoft.dz/categorie.php?id=11',
        'case': 'https://hardsoft.dz/categorie.php?id=28',
        'cooling': 'https://hardsoft.dz/categorie.php?id=47',
        'thermal-paste': 'https://hardsoft.dz/categorie.php?id=88',
        'pc-pack': 'https://hardsoft.dz/categorie.php?id=60',
    }

    peripherals = {
        'headset': 'https://hardsoft.dz/categorie.php?id=73',
        'keyboard': 'https://hardsoft.dz/categorie.php?id=29',
        'mouse': 'https://hardsoft.dz/categorie.php?id=2',
        'monitor-gamer': 'https://hardsoft.dz/categorie.php?id=83',
        'monitor-office': 'https://hardsoft.dz/categorie.php?id=84',
    }

    # Test one category page
    test_url = categories['graphics-card']
    r = requests.get(test_url, headers=HEADERS, timeout=20)
    tsoup = BeautifulSoup(r.text, 'lxml')

    # Find product structure
    products = []
    for article in tsoup.find_all('div', class_=lambda c: c and 'articles' in str(c).lower()):
        link = article.find('a', href=True)
        name = article.find(['h2', 'h3', 'h4', 'strong'])
        price = article.find(string=lambda s: s and re.search(r'\d+[\s,.]*\d*', s) and 'DA' in s)
        img = article.find('img')
        if name and price:
            products.append({
                'name': name.get_text(strip=True),
                'price': price.strip(),
                'url': urljoin(base, link['href']) if link else '',
                'image': urljoin(base, img['src']) if img and img.get('src') else '',
            })

    # Pagination
    pagination = []
    for link in tsoup.find_all('a', href=True):
        href = link['href']
        if 'page' in href.lower() or 'p=' in href:
            pagination.append(href)

    return {
        'store': 'hardsoft.dz',
        'base_url': base,
        'type': 'custom-php',
        'categories': {**categories, **peripherals},
        'product_selector': 'div.articles',
        'name_selector': 'h2, h3, strong',
        'price_selector': 'string with DA',
        'image_selector': 'img',
        'url_selector': 'a',
        'pagination_pattern': '?page={page}' if pagination else None,
        'sample_products': products[:3],
        'price_format': '258900.00 DA',
    }


def map_site(url, name, category_paths=None):
    """Generic site mapper — fetch homepage and extract categories."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        soup = BeautifulSoup(resp.text, 'lxml')

        # Find all category/product links
        links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            text = a.get_text(strip=True)
            if len(text) < 3 or len(text) > 60:
                continue
            # Look for category/product patterns
            if any(x in href.lower() for x in ['categorie', 'category', 'product', 'produit', 'shop', 'collection']):
                links.append({'href': urljoin(url, href), 'text': text})

        # Deduplicate
        seen = set()
        unique_links = []
        for l in links:
            if l['href'] not in seen:
                seen.add(l['href'])
                unique_links.append(l)

        return {
            'store': name,
            'base_url': url,
            'categories_found': len(unique_links),
            'category_links': unique_links[:15],
        }
    except Exception as e:
        return {'store': name, 'error': str(e)}


def map_all_sites():
    """Map all stores in our scraper pipeline."""
    sites = {
        'hardsoft.dz': 'https://hardsoft.dz',
        'lahlou-industrie.com': 'https://lahlou-industrie.com',
        'gamingdz.com': 'https://gamingdz.com',
        'geekzonedz.com': 'https://geekzonedz.com',
        'gigastoredz.com': 'https://gigastoredz.com',
        'digitecdz.com': 'https://digitecdz.com',
        'matos-gaming.com': 'https://matos-gaming.com',
    }

    results = {}

    # HardSoft needs special mapping
    print("Mapping HardSoft DZ...")
    results['hardsoft.dz'] = map_hardsoft()

    # Generic mapping for other sites
    for name, url in sites.items():
        if name == 'hardsoft.dz':
            continue
        print(f"Mapping {name}...")
        results[name] = map_site(url, name)

    return results


if __name__ == '__main__':
    results = map_all_sites()
    with open('site-maps.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\nSaved to site-maps.json")

    # Print summary
    for store, data in results.items():
        print(f"\n{store}:")
        if 'error' in data:
            print(f"  ERROR: {data['error']}")
        else:
            cats = data.get('categories', {})
            print(f"  Categories: {len(cats)}")
            for cat, url in list(cats.items())[:5]:
                print(f"    {cat}: {url}")
            sample = data.get('sample_products', [])
            if sample:
                print(f"  Sample products:")
                for p in sample[:2]:
                    print(f"    {p['name'][:40]} @ {p['price']}")
