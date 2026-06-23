/**
 * Cloudflare Bypass Module for Deal Finder DZ
 * Multi-strategy scraper for CF-protected Algerian sites
 * 
 * Strategies (in order of preference):
 * 1. WooCommerce REST API — bypasses CF entirely, returns JSON
 * 2. WordPress REST API — bypasses CF entirely, returns JSON
 * 3. CSS selectors on rendered HTML — for non-WP sites
 * 4. Playwright (fallback) — full browser automation
 * 
 * Sites solved:
 * - DigiTec DZ: 100+ products via WC Store API
 * - Gaming DZ: 4+ products via CSS (expandable)
 * - LICB+: Needs Playwright (hard CF block)
 * - PC Line: Needs Playwright (hard CF block)
 */

const axios = require("axios");
const cheerio = require("cheerio");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─── Config ───
const http = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
  },
});

// Cookie jar for session persistence
let cookieJar = {};
const COOKIE_FILE = path.join(__dirname, ".cf-cookies.json");

// Load saved cookies
function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      cookieJar = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
      console.log(`[CF-BYPASS] Loaded cookies for ${Object.keys(cookieJar).length} domains`);
    }
  } catch (e) {
    cookieJar = {};
  }
}

// Save cookies
function saveCookies() {
  try {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieJar, null, 2));
  } catch (e) {
    // Silently fail
  }
}

// Get cookies for a domain
function getCookiesForDomain(domain) {
  return cookieJar[domain] || "";
}

// Set cookies for a domain
function setCookiesForDomain(domain, cookies) {
  cookieJar[domain] = cookies;
}

// ─── Price Parser ───
function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).toLowerCase()
    .replace(/د\.ج/g, "")
    .replace(/dzd/gi, "")
    .replace(/da\b/gi, "")
    .replace(/dinar/gi, "")
    .replace(/,/g, "")
    .trim();

  // European: "129.000"
  let m = cleaned.match(/(\d{1,3}(?:\.\d{3})+)/);
  if (m) return parseInt(m[1].replace(/\./g, ""));

  // Space: "129 000"
  m = cleaned.match(/(\d{1,3}(?:\s+\d{3})+)/);
  if (m) return parseInt(m[1].replace(/\s/g, ""));

  // Plain
  m = cleaned.match(/(\d{3,})/);
  if (m) return parseInt(m[1]);

  return null;
}

// ─── Category Inference ───
function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("iphone") || t.includes("samsung") || t.includes("xiaomi") || t.includes("phone")) return "phone";
  if (t.includes("rtx") || t.includes("gtx") || t.includes("rx ") || t.includes("radeon") || t.includes("carte graphique") || t.includes("geforce")) return "pc_part";
  if (t.includes("processeur") || t.includes("ryzen") || t.includes("core i") || t.includes("intel") || t.includes("core ultra") || t.includes("cpu")) return "pc_part";
  if (t.includes("ecran") || t.includes("monitor") || t.includes("moniteur") || t.includes("display") || t.includes("oled")) return "monitor";
  if (t.includes("carte mere") || t.includes("carte mère") || t.includes("motherboard")) return "pc_part";
  if (t.includes("alimentation") || t.includes("boitier") || t.includes("case ")) return "pc_part";
  if (t.includes("ram ") || t.includes("ddr")) return "pc_part";
  if (t.includes("ssd") || t.includes("nvme")) return "pc_part";
  if (t.includes("unite gaming") || t.includes("pc gamer") || t.includes("unité gaming")) return "pc_part";
  if (t.includes("laptop") || t.includes("notebook") || t.includes("pc portable")) return "laptop";
  if (t.includes("souris") || t.includes("clavier") || t.includes("casque") || t.includes("headset")) return "accessory";
  if (t.includes("tablette") || t.includes("tab ") || t.includes("galaxy tab")) return "phone";
  return "pc_part";
}

// ─── STRATEGY 1: WooCommerce Store API ───
async function tryWooCommerceAPI(baseUrl, siteName) {
  const endpoints = [
    `${baseUrl}/wp-json/wc/store/v1/products?per_page=100`,
    `${baseUrl}/wp-json/wc/v3/products?per_page=100&page=1`,
  ];

  const items = [];
  for (const ep of endpoints) {
    try {
      const resp = await http.get(ep, { validateStatus: () => true });
      if (resp.status === 200 && resp.headers["content-type"]?.includes("json")) {
        const data = Array.isArray(resp.data) ? resp.data : [];

        for (const p of data) {
          const title = p.name || "";
          const price = parsePrice(p.prices?.price || p.price || "");
          const url = p.permalink || "";

          if (title && price && price > 1000) {
            items.push({
              source: siteName,
              title: title.substring(0, 120),
              price,
              url,
              category: inferCategory(title),
              location: "Algeria",
              condition: "new",
            });
          }
        }

        if (items.length > 0) return items;
      }
    } catch (e) {
      // Continue to next endpoint
    }
  }
  return items;
}

// ─── STRATEGY 2: WordPress REST API ───
async function tryWordPressAPI(baseUrl, siteName) {
  try {
    const resp = await http.get(`${baseUrl}/wp-json/wp/v2/posts?per_page=100`, { validateStatus: () => true });
    if (resp.status === 200 && Array.isArray(resp.data) && resp.data.length > 0) {
      // This gives posts, not products. Check if they contain product info
      return []; // Not useful for products
    }
  } catch (e) {
    return [];
  }
  return [];
}

// ─── STRATEGY 3: CSS Selectors on rendered HTML ───
async function tryCSSSelectors(baseUrl, siteName, config = {}) {
  const items = [];
  const selectorGroups = config.selectors || [
    [".product.type-product", ".woocommerce-loop-product__title", ".price bdi, .price"],
    [".product", "h2.woocommerce-loop-product__title, h2, h3", ".price"],
    ["ul.products li", "h2, h3", ".price"],
    [".product-item", ".product-title, h2, h3", ".product-price, .price"],
    [".product-card", ".product-title, h2, h3", ".product-price, .price"],
    ["[class*='product']", "h2, h3, .title", ".price"],
  ];

  const urlsToTry = config.urls || [baseUrl];

  for (const url of urlsToTry) {
    try {
      const resp = await http.get(url, { validateStatus: () => true });
      if (resp.status !== 200 || resp.data.length < 5000) continue;

      const $ = cheerio.load(resp.data);
      const title = $("title").text().trim();
      if (title.includes("challenge") || title.includes("Cloudflare")) continue;

      for (const [prodSel, titleSel, priceSel] of selectorGroups) {
        $(prodSel).each((_, el) => {
          const $el = $(el);
          const title = $el.find(titleSel).first().text().trim();
          const price = parsePrice($el.find(priceSel).first().text().trim());
          const link = $el.find("a").first().attr("href") || "";

          if (title && title.length > 3 && price && price > 1000) {
            items.push({
              source: siteName,
              title: title.substring(0, 120),
              price,
              url: link.startsWith("http") ? link : `${baseUrl}${link}`,
              category: inferCategory(title),
              location: config.location || "Algeria",
              condition: "new",
            });
          }
        });

        if (items.length > 0) return items;
      }
    } catch (e) {
      // Continue
    }
  }

  return items;
}

// ─── STRATEGY 4: Playwright (Python fallback) ───
async function tryPlaywright(url, siteName, selectors = {}) {
  return new Promise((resolve) => {
    // Call Python Playwright script
    const pyScript = path.join(__dirname, "playwright-scrape.py");
    if (!fs.existsSync(pyScript)) {
      resolve([]);
      return;
    }

    const proc = spawn("python3", [pyScript, url, JSON.stringify(selectors)], {
      timeout: 60000,
    });

    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", (d) => { /* Silent */ });

    proc.on("close", () => {
      try {
        const items = JSON.parse(output);
        resolve(items.map(i => ({ ...i, source: siteName })));
      } catch {
        resolve([]);
      }
    });

    proc.on("error", () => resolve([]));
  });
}

// ─── Site Definitions ───
const CF_SITES = [
  {
    name: "DigiTec DZ",
    baseUrl: "https://digitecdz.com",
    strategies: ["wc_api", "css"],
    location: "Alger",
  },
  {
    name: "Gaming DZ",
    baseUrl: "https://gamingdz.com",
    strategies: ["css"],
    urls: [
      "https://gamingdz.com/store/composants/cartes-graphiques",
      "https://gamingdz.com/store/composants/processeurs",
      "https://gamingdz.com/store/composants/cartes-meres",
      "https://gamingdz.com/store/composants/alimentations",
    ],
    location: "Alger",
  },
  {
    name: "LICB+",
    baseUrl: "https://www.licbplus.com.dz",
    strategies: ["wc_api", "css", "playwright"],
    urls: [
      "https://www.licbplus.com.dz/pc-components/cartes-graphiques",
      "https://www.licbplus.com.dz/pc-components/processeurs",
      "https://www.licbplus.com.dz/pc-components/cartes-meres",
    ],
    location: "Tlemcen",
  },
  {
    name: "PC Line",
    baseUrl: "https://www.pcline.dz",
    strategies: ["wc_api", "css", "playwright"],
    location: "Alger",
  },
];

// ─── Main Scrape Function ───
async function scrapeCloudflareSites() {
  loadCookies();
  const allProducts = [];
  const results = {};

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Cloudflare Bypass Scraper");
  console.log("═══════════════════════════════════════════════════\n");

  for (const site of CF_SITES) {
    process.stdout.write(`[${site.name.padEnd(15)}] `);
    let items = [];

    for (const strategy of site.strategies) {
      try {
        if (strategy === "wc_api") {
          items = await tryWooCommerceAPI(site.baseUrl, site.name);
          if (items.length > 0) {
            console.log(`${String(items.length).padStart(3)} products via WC API`);
            break;
          }
        } else if (strategy === "wp_api") {
          items = await tryWordPressAPI(site.baseUrl, site.name);
          if (items.length > 0) {
            console.log(`${String(items.length).padStart(3)} products via WP API`);
            break;
          }
        } else if (strategy === "css") {
          items = await tryCSSSelectors(site.baseUrl, site.name, {
            urls: site.urls,
            location: site.location,
          });
          if (items.length > 0) {
            console.log(`${String(items.length).padStart(3)} products via CSS`);
            break;
          }
        } else if (strategy === "playwright") {
          console.log("Trying Playwright...");
          items = await tryPlaywright(site.baseUrl, site.name);
          if (items.length > 0) {
            console.log(`${String(items.length).padStart(3)} products via Playwright`);
            break;
          }
        }
      } catch (e) {
        // Continue to next strategy
      }
    }

    if (items.length === 0) {
      console.log("  0 products (all strategies failed)");
    }

    allProducts.push(...items);
    results[site.name] = items.length;
  }

  saveCookies();

  // Summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════");
  let total = 0;
  for (const [name, count] of Object.entries(results).sort((a, b) => b[1] - a[1])) {
    const icon = count > 0 ? "OK" : "FAIL";
    console.log(`  [${icon}] ${name.padEnd(15)} ${String(count).padStart(3)} products`);
    total += count;
  }
  console.log(`  ───────────────────────────────────────────`);
  console.log(`  TOTAL: ${total} products`);
  console.log("═══════════════════════════════════════════════════");

  return allProducts;
}

// ─── Run if called directly ───
if (require.main === module) {
  scrapeCloudflareSites().then((products) => {
    const fs = require("fs");
    fs.writeFileSync(
      path.join(__dirname, "cf-products.json"),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        total: products.length,
        products,
      }, null, 2)
    );
    console.log("\nSaved to scripts/cf-products.json");
  }).catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}

module.exports = { scrapeCloudflareSites, tryWooCommerceAPI, tryCSSSelectors, parsePrice };
