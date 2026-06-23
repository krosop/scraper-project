# Cloudflare Bypass Solutions for Deal Finder DZ

## Test Results Summary

| Site | Strategy | Status | Products |
|------|----------|--------|----------|
| **DigiTec DZ** | WooCommerce REST API | SOLVED | 100+ |
| **Gaming DZ** | curl_cffi + CSS selectors | SOLVED | 12+ (expandable) |
| **LICB+** | curl_cffi (partial) | NEEDS JS | Homepage works, products need Playwright |
| **PC Line** | Fully blocked | NEEDS PLAYWRIGHT | Requires full browser |

---

## Strategy 1: WooCommerce REST API (DIGITEC) - WORKING

DigiTec uses WooCommerce which exposes a REST API that **bypasses Cloudflare entirely**.

```
GET https://digitecdz.com/wp-json/wc/store/v1/products?per_page=100
```

Returns clean JSON with name, price, permalink. No CF challenge.

**Code**: See `cf-scraper.py` → `scrape_wc_api()`

---

## Strategy 2: curl_cffi TLS Impersonation (GAMING DZ) - WORKING

Gaming DZ uses a custom Shopify/WooCommerce hybrid. curl_cffi impersonates a real Chrome browser's TLS fingerprint, bypassing CF's TLS detection.

```python
from curl_cffi import requests
r = requests.get(url, impersonate="chrome120")
```

**Key selectors for Gaming DZ:**
- Product container: `.product-cart-wrap`
- Title: `h2 a` (inside `.product-content-wrap`)
- Price: `.product-price`
- Price format: `214,900.00 DA`

**Code**: See `cf-scraper.py` → `scrape_css()`

---

## Strategy 3: Playwright with Stealth (LICB+, PC LINE) - NEEDED

For sites with JavaScript challenges or heavy obfuscation, a full headless browser is required.

### Install on GitHub Actions:
```yaml
- name: Install Playwright
  run: |
    npm install -g playwright
    npx playwright install chromium
    pip3 install playwright
    python3 -m playwright install chromium
```

### Python Playwright scraper:
```python
from playwright.sync_api import sync_playwright

def scrape_with_playwright(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(url, wait_until="networkidle", timeout=30000)
        html = page.content()
        browser.close()
        return html
```

### GitHub Actions cost: ~45 seconds per site per run = ~3 min/day = 90 min/month (within 2,000 min limit)

---

## Strategy 4: Session Cookie Persistence

Some sites (like LICB+) allow access after solving the challenge once. Save cookies and reuse.

```python
# After successful challenge solve
import json
# Save cookies
cookies = session.cookies.get_dict()
with open(".cf-cookies.json", "w") as f:
    json.dump(cookies, f)

# Next run, load cookies
with open(".cf-cookies.json") as f:
    cookies = json.load(f)
session = requests.Session()
for name, value in cookies.items():
    session.cookies.set(name, value)
```

**Limitation**: Cloudflare cookies expire quickly (hours), so this only helps within the same scraping session.

---

## Strategy 5: Smart URL Variants

LICB+ showed that `www.` subdomain can trigger CF while the bare domain doesn't:

| URL | Result |
|-----|--------|
| `https://www.licbplus.com.dz` | BLOCKED |
| `https://licbplus.com.dz` | WORKS (355KB) |

Always try both `www.` and bare domain variants.

---

## Complete CF Bypass Module

The production module is at: `scripts/cf-scraper.py`

Run it:
```bash
# All CF sites
python3 scripts/cf-scraper.py

# Single site
python3 scripts/cf-scraper.py digitec
python3 scripts/cf-scraper.py gamingdz
python3 scripts/cf-scraper.py licb
python3 scripts/cf-scraper.py pcline
```

Output: JSON array of products to stdout.

---

## Integration with Main Scraper

The Node.js main scraper (`scripts/scrape.cjs`) calls the Python module:

```javascript
const { spawn } = require("child_process");

async function scrapeCloudflareSites() {
  return new Promise((resolve) => {
    const proc = spawn("python3", ["scripts/cf-scraper.py"]);
    let output = "";
    proc.stdout.on("data", (d) => { output += d; });
    proc.on("close", () => {
      try { resolve(JSON.parse(output)); } catch { resolve([]); }
    });
  });
}
```

---

## Required Dependencies

```bash
# Python (for CF bypass)
pip3 install curl_cffi cloudscraper beautifulsoup4 lxml

# For Playwright fallback
pip3 install playwright
python3 -m playwright install chromium
```

---

## Cost Analysis (GitHub Actions Free Tier)

| Task | Time/Run | Runs/Day | Monthly |
|------|----------|----------|---------|
| Tier 1 scraper (axios) | ~25s | 4 | ~100 min |
| CF bypass (curl_cffi) | ~15s | 4 | ~60 min |
| Playwright fallback | ~90s | 2 | ~180 min |
| Cleanup | ~5s | 4 | ~20 min |
| **Total** | | | **~360 min / 2,000 min** |

Well within the 2,000 min/month limit.
