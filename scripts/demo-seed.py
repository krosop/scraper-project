#!/usr/bin/env python3
"""
Demo Seed Script — Extract real products and seed to Supabase
"""

import sys, json, re
sys.path.insert(0, '.')

from curl_cffi import requests as curl
from bs4 import BeautifulSoup
import cloudscraper

cf_scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}, delay=8)
API_KEY = 'ak-yxxpt-n76bv-q6gxv-857z2-vbc2c'

def parse_price(text):
    if not text: return None
    c = str(text).lower().replace('\n',' ').replace('\t',' ').replace('\xa0',' ')
    c = c.replace('د.ج','').replace('dzd','').replace('da','').replace('dinar','').replace(',','').strip()
    m = re.search(r'(\d{1,3}(?:\s+\d{3})+)', c)
    if m: return int(m.group(1).replace(' ',''))
    m = re.search(r'(\d{3,})', c)
    if m: return int(m.group(1))
    return None

def infer_cat(title):
    t = title.lower()
    if any(k in t for k in ['rtx','gtx','radeon','rx ','carte graphique','geforce']): return 'pc_part'
    if any(k in t for k in ['processeur','ryzen','core i','intel','core ultra','cpu']): return 'pc_part'
    if any(k in t for k in ['ecran','monitor','moniteur','display','oled']): return 'monitor'
    if any(k in t for k in ['carte mere','carte mère','motherboard']): return 'pc_part'
    if any(k in t for k in ['alimentation','boitier','case ','psu','w ','watt']): return 'pc_part'
    if any(k in t for k in ['ram ','ddr']): return 'pc_part'
    if any(k in t for k in ['ssd','nvme','m.2']): return 'pc_part'
    if any(k in t for k in ['unite gaming','pc gamer','unité gaming']): return 'pc_part'
    if any(k in t for k in ['laptop','notebook','pc portable']): return 'laptop'
    if any(k in t for k in ['watercooling','pate thermique','pâte thermique','refroidisseur']): return 'pc_part'
    if any(k in t for k in ['souris','clavier','casque','headset']): return 'accessory'
    return 'pc_part'

def phantom(url):
    try:
        payload = {'url': url, 'renderType': 'html',
            'requestSettings': {'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'waitInterval': 12000}}
        r = curl.post(f'https://phantomjscloud.com/api/browser/v2/{API_KEY}/', json=payload, timeout=90)
        if r.status_code == 200 and len(r.text) > 5000: return r.text
    except: pass
    return None

def curl_fetch(url):
    try:
        r = curl.get(url, impersonate='chrome120', timeout=25)
        if r.status_code == 200 and len(r.text) > 3000: return r.text
    except: pass
    try:
        r = cf_scraper.get(url, timeout=25)
        if r.status_code == 200 and len(r.text) > 3000: return r.text
    except: pass
    return None

def extract_digitec(html):
    soup = BeautifulSoup(html, 'lxml')
    items = []
    for p in soup.select('.product.type-product'):
        t = p.select_one('.woocommerce-loop-product__title')
        if not t:
            a = p.select_one('.woocommerce-LoopProduct-link')
            t = a
        title = t.get_text(strip=True) if t else ''
        pr = p.select_one('.price bdi, .price .woocommerce-Price-amount, .price')
        price = parse_price(pr.get_text(strip=True)) if pr else None
        link = p.select_one('a.woocommerce-LoopProduct-link')
        url = link.get('href', '') if link else ''
        if title and len(title) > 3 and price and price > 1000:
            cat = infer_cat(title)
            if cat == 'phone': continue
            items.append({'source': 'DigiTec DZ', 'title': title[:120], 'price': price,
                'url': url, 'category': cat, 'location': 'Alger', 'condition': 'new'})
    return items

def extract_gamingdz(html):
    soup = BeautifulSoup(html, 'lxml')
    items = []
    for p in soup.select('.product-cart-wrap'):
        t = p.select_one('h2 a, h3 a, .product-title')
        pr = p.select_one('.product-price')
        title = t.get_text(strip=True) if t else ''
        price = parse_price(pr.get_text(strip=True)) if pr else None
        link = p.find('a')
        url = link.get('href', '') if link else ''
        if title and len(title) > 3 and price and price > 1000:
            cat = infer_cat(title)
            if cat == 'phone': continue
            items.append({'source': 'Gaming DZ', 'title': title[:120], 'price': price,
                'url': url, 'category': cat, 'location': 'Alger', 'condition': 'new'})
    return items

def extract_licb(html):
    soup = BeautifulSoup(html, 'lxml')
    items = []
    for p in soup.select('.product.type-product, .product-item, .product-card, [class*="product"]')[:200]:
        t = p.select_one('.woocommerce-loop-product__title, h2 a, h3 a, .title, a')
        pr = p.select_one('.price bdi, .price, .product-price')
        title = t.get_text(strip=True) if t else ''
        price = parse_price(pr.get_text(strip=True)) if pr else None
        link = p.find('a')
        url = link.get('href', '') if link else ''
        if title and len(title) > 3 and price and price > 1000:
            cat = infer_cat(title)
            if cat == 'phone': continue
            items.append({'source': 'LICB+', 'title': title[:120], 'price': price,
                'url': url, 'category': cat, 'location': 'Tlemcen', 'condition': 'new'})
    return items

def main():
    all_items = []

    # DigiTec
    print("[DigiTec] Scraping...", file=sys.stderr)
    html = phantom('https://digitecdz.com')
    if html:
        items = extract_digitec(html)
        all_items.extend(items)
        print(f"[DigiTec] {len(items)} products", file=sys.stderr)

    # Gaming DZ
    print("[Gaming DZ] Scraping...", file=sys.stderr)
    html = curl_fetch('https://gamingdz.com/store/composants/cartes-graphiques')
    if html:
        items = extract_gamingdz(html)
        all_items.extend(items)
        print(f"[Gaming DZ] {len(items)} products", file=sys.stderr)

    # LICB+
    print("[LICB+] Scraping...", file=sys.stderr)
    html = phantom('https://licbplus.com.dz')
    if html:
        items = extract_licb(html)
        all_items.extend(items)
        print(f"[LICB+] {len(items)} products", file=sys.stderr)

    print(f"[TOTAL] {len(all_items)} products", file=sys.stderr)
    print(json.dumps(all_items, ensure_ascii=False))

if __name__ == "__main__":
    main()
