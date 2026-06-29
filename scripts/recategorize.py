import json
import sys
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts' / 'pc-parts-scraper'))
from categorizer import detect_category

CATEGORY_MAP = {
    'gpu': 'graphics-cards',
    'cpu': 'processors',
    'ram': 'memory',
    'motherboard': 'pc-parts',
    'storage': 'storage',
    'monitor': 'monitors',
    'psu': 'power-supplies',
    'case': 'cases',
    'cooling': 'cooling',
    'keyboard': 'keyboard',
    'mouse': 'mouse',
    'headset': 'headset',
    'laptop': 'pc-parts',
    'desktop': 'pc-parts',
    'unknown': 'pc-parts',
}


def main():
    paths = [
        Path('public/clean-products.json'),
        Path('server/data/clean-products.json'),
    ]
    
    for path in paths:
        if not path.exists():
            continue
            
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        products = data['products']
        changed = 0
        
        for p in products:
            name = p.get('name', '')
            url = ''
            listings = p.get('listings', [])
            if listings:
                url = listings[0].get('url', '')
            
            new_cat = detect_category(name, url)
            old_cat = p.get('category', '')
            
            if new_cat != old_cat:
                p['category'] = new_cat
                changed += 1
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f'[+] {path}: re-categorized {changed}/{len(products)} products')


if __name__ == '__main__':
    main()
