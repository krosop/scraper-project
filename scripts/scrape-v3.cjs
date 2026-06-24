/**
 * Deal Finder DZ — Multi-Site Scraper v3 (Scrapling-Inspired)
 * Upgraded with: stealth headers, concurrent scraping, retry logic,
 * adaptive parsing, and Cloudflare bypass detection
 */

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// ─── Load Sitemap ───
const sitemap = JSON.parse(fs.readFileSync(path.join(__dirname, "sitemap.json"), "utf-8"));

// ─── Scrapling-Inspired: Browser Profile Rotation ───
const BROWSER_PROFILES = [
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLanguage: "en-US,en;q=0.9,fr;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
  },
  {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    acceptLanguage: "en-US,en;q=0.9",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptLanguage: "en-US,en;q=0.5",
    acceptEncoding: "gzip, deflate, br",
    secChUa: undefined, // Firefox doesn't send this
    secChUaMobile: undefined,
    secChUaPlatform: undefined,
  },
  {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    acceptLanguage: "en-US,en;q=0.9",
    acceptEncoding: "gzip, deflate, br",
    secChUa: undefined,
    secChUaMobile: undefined,
    secChUaPlatform: undefined,
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    acceptLanguage: "en-US,en;q=0.9,fr;q=0.8",
    acceptEncoding: "gzip, deflate, br",
    secChUa: '"Not/A)Brand";v="8", "Chromium";v="125", "Microsoft Edge";v="125"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
  },
];

function getRandomProfile() {
  return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
}

function buildHeaders(profile, referer) {
  const headers = {
    "User-Agent": profile.userAgent,
    "Accept": profile.accept,
    "Accept-Language": profile.acceptLanguage,
    "Accept-Encoding": profile.acceptEncoding,
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
  };
  if (profile.secChUa) headers["sec-ch-ua"] = profile.secChUa;
  if (profile.secChUaMobile) headers["sec-ch-ua-mobile"] = profile.secChUaMobile;
  if (profile.secChUaPlatform) headers["sec-ch-ua-platform"] = profile.secChUaPlatform;
  if (referer) headers["Referer"] = referer;
  return headers;
}

// ─── Scrapling-Inspired: HTTP Client with Retry & Pooling ───
function createHttpClient(siteDef) {
  const profile = getRandomProfile();
  const baseHeaders = buildHeaders(profile);
  
  return axios.create({
    timeout: 30000,
    maxRedirects: 5,
    headers: baseHeaders,
    // Connection pooling for reuse across requests
    httpAgent: new (require("http").Agent)({ keepAlive: true, maxSockets: 5 }),
    httpsAgent: new (require("https").Agent)({ keepAlive: true, maxSockets: 5 }),
    // Scrapling-inspired: decompress response
    decompress: true,
  });
}

// ─── Scrapling-Inspired: Retry with Exponential Backoff ───
async function fetchWithRetry(http, url, retries = 3, baseDelay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await http.get(url);
      return response;
    } catch (error) {
      const status = error.response?.status;
      
      // Don't retry on 404
      if (status === 404) {
        throw error;
      }
      
      // Don't retry on 403 (blocked) unless it's a temporary rate limit
      if (status === 403 && !error.response?.headers?.["retry-after"]) {
        throw error;
      }
      
      // Exponential backoff with jitter: delay * (2^attempt) + random(0-1000ms)
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
      
      console.log(`  [Retry ${attempt}/${retries}] ${url} failed (${status || error.code}), waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

// ─── Scrapling-Inspired: Cloudflare Detection ───
function detectCloudflare(html, status, title) {
  if (status === 403 || status === 503) return true;
  if (!html) return false;
  
  const checks = [
    title?.includes("Cloudflare"),
    title?.includes("Just a moment"),
    title?.includes("Security check"),
    html.includes("cf-browser-verification"),
    html.includes("cf-im-under-attack"),
    html.includes("challenge-platform"),
    html.includes("turnstile"),
    html.includes("__cf_chl_jschl_tk__"),
    html.includes("Checking if the site connection is secure"),
    html.includes("DDoS protection by Cloudflare"),
    // Akamai/DataDome detection
    html.includes("data-dome"),
    html.includes("akamai"),
    html.includes("ak-bmsc"),
    // PerimeterX/Incapsula
    html.includes("perimeterx"),
    html.includes("px-captcha"),
    html.includes("incap_ses"),
    // ReCaptcha
    html.includes("g-recaptcha"),
    html.includes("google.com/recaptcha"),
  ];
  
  return checks.some(Boolean);
}

// ─── Scrapling-Inspired: Adaptive Parsing (3-tier fallback) ───
function adaptiveExtract($, $el, selectorMap) {
  // Tier 1: Primary selector
  let value = $el.find(selectorMap.primary).first().text().trim();
  if (value && value.length > 0) return value;
  
  // Tier 2: Fallback selectors
  for (const fallback of selectorMap.fallbacks || []) {
    value = $el.find(fallback).first().text().trim();
    if (value && value.length > 0) return value;
  }
  
  // Tier 3: Generic fallback
  if (selectorMap.generic) {
    const generic = $el.find(selectorMap.generic).filter((_, el) => $(el).text().trim().length > 3);
    if (generic.length > 0) return generic.first().text().trim();
  }
  
  return "";
}

// ─── Price Parser (enhanced with more Algerian formats) ───
function parsePrice(text) {
  if (!text) return null;
  let cleaned = text.toString()
    .replace(/د\.ج/g, "")
    .replace(/DZD/gi, "")
    .replace(/DA\b/gi, "")
    .replace(/Dinar/gi, "")
    .replace(/Prix/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ") // normalize spaces
    .trim();

  // European: "129.000,00" or "129.000" -> 129000
  const euroMatch = cleaned.match(/(\d{1,3}(?:\.\d{3})+)(?:,\d+)?/);
  if (euroMatch) return parseInt(euroMatch[1].replace(/\./g, ""));

  // Space-separated: "129 000" -> 129000
  const spaceMatch = cleaned.match(/(\d{1,3}(?:\s+\d{3})+)/);
  if (spaceMatch) return parseInt(spaceMatch[1].replace(/\s/g, ""));

  // Plain: "39000"
  const plainMatch = cleaned.match(/(\d{3,})/);
  if (plainMatch) return parseInt(plainMatch[1]);
  
  // Handle "1 234 567" with multiple spaces
  const multiSpaceMatch = cleaned.match(/(\d{1,3}(?:\s+\d{3})+)/g);
  if (multiSpaceMatch) {
    const largest = multiSpaceMatch.reduce((a, b) => a.length > b.length ? a : b);
    return parseInt(largest.replace(/\s/g, ""));
  }

  return null;
}

// ─── Category Inference (unchanged) ───
function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("iphone") || t.includes("samsung") || t.includes("xiaomi") || t.includes("phone") || t.includes("gsm")) return "phone";
  if (t.includes("rtx") || t.includes("gtx") || t.includes("rx ") || t.includes("radeon") || t.includes("carte graphique") || t.includes("gpu")) return "pc_part";
  if (t.includes("processeur") || t.includes("ryzen") || t.includes("core i") || t.includes("intel") || t.includes("cpu")) return "pc_part";
  if (t.includes("ecran") || t.includes("monitor") || t.includes("moniteur") || t.includes("display") || t.includes("oled")) return "monitor";
  if (t.includes("ram") || t.includes("ddr")) return "pc_part";
  if (t.includes("ssd") || t.includes("nvme") || t.includes("m.2")) return "pc_part";
  if (t.includes("laptop") || t.includes("pc portable") || t.includes("notebook")) return "laptop";
  if (t.includes("souris") || t.includes("clavier") || t.includes("headset") || t.includes("casque") || t.includes("keyboard") || t.includes("mouse")) return "accessory";
  if (t.includes("boitier") || t.includes("alimentation") || t.includes("watercooling") || t.includes("refroidisseur")) return "pc_part";
  if (t.includes("carte mere") || t.includes("carte mère") || t.includes("motherboard")) return "pc_part";
  if (t.includes("pate thermique") || t.includes("pâte thermique")) return "pc_part";
  if (t.includes("pc gamer") || t.includes("pc fixe")) return "pc_part";
  return "pc_part";
}

function inferLocation(domain) {
  const locMap = {
    "kotekdz.com": "Alger",
    "gamingdz.com": "Alger",
    "gigastore-dz.com": "Alger",
    "licbplus.com.dz": "Tlemcen",
    "wifidjelfa.com": "Djelfa",
    "horizon-biskra.com": "Biskra",
  };
  return locMap[domain] || "Algeria";
}

// ─── Scrapling-Inspired: Generic Site Scraper with Adaptive Parsing ───
async function scrapeSite(siteDef, maxPages = 1) {
  const items = [];
  const s = siteDef.selectors || {};
  const baseUrl = siteDef.base_url;
  const http = createHttpClient(siteDef);
  
  // Build adaptive selector map
  const titleSelectors = {
    primary: s.product_name || ".woocommerce-loop-product__title",
    fallbacks: [
      ".product-title", ".product-name", "h2", "h3",
      ".item-title", ".product-title a", ".entry-title",
      "[class*='title']", "[class*='name']"
    ],
    generic: "a"
  };
  
  const priceSelectors = {
    primary: s.product_price || ".price bdi",
    fallbacks: [
      ".price .amount", ".price", ".woocommerce-Price-amount",
      "[class*='price']", "[class*='prix']", "[class*='cout']",
      ".current-price", ".sale-price", ".product-price"
    ],
    generic: "span, div"
  };
  
  const linkSelectors = {
    primary: s.product_link || "a",
    fallbacks: ["a[href]", ".product-link"],
    generic: "a"
  };
  
  const imageSelectors = {
    primary: s.product_image || "img",
    fallbacks: ["img[src]", ".product-image img", "img.attachment-woocommerce_thumbnail"],
    generic: "img"
  };

  // Determine which URLs to scrape
  let urlsToScrape = [];
  if (siteDef.urls?.categories && siteDef.urls.categories.length > 0) {
    for (const cat of siteDef.urls.categories.slice(0, 4)) {
      urlsToScrape.push(`${baseUrl}${cat}`);
    }
  } else if (siteDef.urls?.shop) {
    urlsToScrape.push(`${baseUrl}${siteDef.urls.shop}`);
  } else {
    urlsToScrape.push(baseUrl);
  }

  for (const url of urlsToScrape) {
    let pageUrls = [url];
    
    // Build pagination URLs
    for (let p = 2; p <= maxPages; p++) {
      const pag = siteDef.pagination || {};
      if (pag.type === "page_numbers") {
        pageUrls.push(`${url}page/${p}/`);
      } else if (pag.type === "query_param") {
        const param = pag.param || "page";
        const sep = url.includes("?") ? "&" : "?";
        pageUrls.push(`${url}${sep}${param}=${p}`);
      } else if (pag.url_pattern) {
        pageUrls.push(`${url}${pag.url_pattern.replace("{page}", p)}`);
      }
    }

    for (const pageUrl of pageUrls) {
      try {
        // Adaptive delay with jitter (Scrapling-style)
        const delay = (siteDef.crawl_delay || 2) * 1000 + Math.floor(Math.random() * 1000);
        await new Promise(r => setTimeout(r, delay));
        
        // Fetch with retry
        const { data: html, status } = await fetchWithRetry(http, pageUrl, 3, 2000);
        const $ = cheerio.load(html);
        
        // Scrapling-style: Multi-signal anti-bot detection
        const title = $("title").text().trim();
        if (detectCloudflare(html, status, title)) {
          console.log(`  [${siteDef.name}] BLOCKED (anti-bot) at ${pageUrl}`);
          break; // Skip this site entirely
        }
        
        // Adaptive parsing: Try multiple product selectors
        let productSelector = s.product_list || ".product";
        let $products = $(productSelector);
        
        // Fallback selectors if primary finds nothing
        if ($products.length === 0) {
          const fallbackSelectors = [
            ".product-item", ".item", ".post", ".entry",
            "[class*='product']", "[class*='item']",
            "article", ".woocommerce-product"
          ];
          for (const fs of fallbackSelectors) {
            $products = $(fs);
            if ($products.length > 0) {
              productSelector = fs;
              break;
            }
          }
        }
        
        console.log(`  [${siteDef.name}] Found ${$products.length} products at ${pageUrl}`);
        
        $products.each((_, el) => {
          const $el = $(el);
          
          // Adaptive extraction
          const title = adaptiveExtract($, $el, titleSelectors);
          const priceText = adaptiveExtract($, $el, priceSelectors);
          const price = parsePrice(priceText);
          
          // Link extraction
          let url = $el.find(linkSelectors.primary).first().attr("href") || "";
          if (!url) {
            url = $el.find(linkSelectors.fallbacks[0]).first().attr("href") || "";
          }
          if (url && !url.startsWith("http")) url = `${baseUrl}${url}`;
          
          // Image extraction
          let imageUrl = $el.find(imageSelectors.primary).first().attr("src") || "";
          if (!imageUrl) {
            imageUrl = $el.find(imageSelectors.fallbacks[0]).first().attr("data-src") || "";
          }
          if (!imageUrl) {
            imageUrl = $el.find(imageSelectors.fallbacks[0]).first().attr("src") || "";
          }
          
          // Skip if no title or price too low
          if (title && title.length > 3 && price && price >= 1000) {
            items.push({
              source: siteDef.name,
              title: title.substring(0, 120),
              price,
              url,
              imageUrl: imageUrl.startsWith("http") ? imageUrl : (imageUrl ? `${baseUrl}${imageUrl}` : ""),
              category: inferCategory(title),
              location: inferLocation(siteDef.domain),
              condition: title.toLowerCase().includes("used") || title.toLowerCase().includes("occasion") ? "used" : "new",
            });
          }
        });
        
      } catch (e) {
        if (e.response?.status === 404) {
          break; // Pagination doesn't exist
        }
        console.log(`  [${siteDef.name}] Error at ${pageUrl}: ${e.message}`);
        // Continue to next page
      }
    }
  }

  return items;
}

// ─── Scrapling-Inspired: Concurrent Site Scraping ───
async function scrapeAllSites(sites, maxPages = 1, concurrency = 3) {
  const allProducts = [];
  const stats = {};
  const t0 = Date.now();
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  DEAL FINDER DZ — MULTI-SITE SCRAPER v3 (Scrapling+)`);
  console.log(`  Concurrent: ${concurrency} sites | Pages/site: ${maxPages}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  // Filter out captcha sites and sort by priority
  const sortedSites = sites
    .filter(s => !s.anti_scraping?.captcha)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));
  
  console.log(`Testing ${sortedSites.length} sites (skipped ${sites.length - sortedSites.length} with captcha)\n`);
  
  // Process sites in concurrent batches
  const pLimit = require("p-limit");
  const limit = pLimit(concurrency);
  
  const siteResults = await Promise.allSettled(
    sortedSites.map(site => 
      limit(async () => {
        try {
          process.stdout.write(`[${site.name.padEnd(25)}] `);
          const items = await scrapeSite(site, maxPages);
          stats[site.name] = { ok: true, count: items.length };
          console.log(`✓ ${items.length} products`);
          return items;
        } catch (e) {
          stats[site.name] = { ok: false, error: e.message };
          console.log(`✗ ${e.message}`);
          return [];
        }
      })
    )
  );
  
  // Collect all results
  for (const result of siteResults) {
    if (result.status === "fulfilled") {
      allProducts.push(...result.value);
    }
  }
  
  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  const successCount = Object.values(stats).filter(s => s.ok).length;
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  RESULTS: ${allProducts.length} products from ${successCount}/${sortedSites.length} sites in ${duration}s`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  return { products: allProducts, stats };
}

// ─── Supabase Upload (enhanced with batching) ───
async function uploadToSupabase(products) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log("Supabase env vars not set, skipping upload");
    return 0;
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { persistSession: false },
      realtime: { enabled: false }
    });

    const { data: sourcesData } = await supabase.from("sources").select("id, name");
    const sourceMap = {};
    if (sourcesData) {
      for (const s of sourcesData) sourceMap[s.name] = s.id;
    }

    let inserted = 0;
    const batchSize = 50; // Process in batches to avoid rate limits
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      for (const item of batch) {
        try {
          // Check for existing product
          const { data: existing } = await supabase
            .from("products").select("id").ilike("canonical_name", `%${item.title}%`).limit(1);

          let productId;
          if (existing?.length > 0) {
            productId = existing[0].id;
          } else {
            const brandMatch = item.title.match(/^(ASUS|MSI|Gigabyte|AMD|Intel|NVIDIA|ZOTAC|Corsair|Cooler Master|Samsung|Apple|Xiaomi|COOLER MASTER|SAPPHIRE|ZOTAC|AGI|MATOS|OCYPUS|GIGABYTE|ASRock|Kingston|Lexar)/i);
            const { data: newProd } = await supabase.from("products").insert({
              canonical_name: item.title,
              category: item.category,
              brand: brandMatch ? brandMatch[1] : null,
            }).select("id").single();
            productId = newProd?.id;
          }

          if (!productId) continue;

          // Get or create source
          let sourceId = sourceMap[item.source];
          if (!sourceId) {
            const { data: newSource } = await supabase.from("sources").insert({
              name: item.source,
              base_url: "https://" + item.source.toLowerCase().replace(/\s+/g, ""),
              scrape_type: "axios",
              is_active: true,
            }).select("id").single();
            sourceId = newSource?.id;
            if (sourceId) sourceMap[item.source] = sourceId;
          }

          if (!sourceId) continue;

          await supabase.from("listings").upsert({
            product_id: productId,
            source_id: sourceId,
            title: item.title,
            price: item.price,
            condition: item.condition,
            location: item.location,
            url: item.url,
            image_url: item.imageUrl || null,
            is_available: true,
            status: "fresh",
            scraped_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: "product_id,source_id,url" });

          inserted++;
        } catch (e) {
          console.error(`Failed to upload ${item.title}: ${e.message}`);
        }
      }
      
      // Small delay between batches
      if (i + batchSize < products.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`Uploaded ${inserted}/${products.length} listings to Supabase`);
    return inserted;
  } catch (e) {
    console.error(`Supabase upload failed: ${e.message}`);
    return 0;
  }
}

// ─── MAIN ───
async function main() {
  const maxPages = process.argv.includes("--full") ? 3 : 1;
  const concurrency = process.argv.includes("--fast") ? 5 : 3;
  
  const { products, stats } = await scrapeAllSites(sitemap.sites, maxPages, concurrency);
  
  // Save results locally
  const resultsPath = path.join(__dirname, "scrape-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify({ 
    timestamp: new Date().toISOString(),
    total: products.length,
    stats,
    products: products // Save ALL products, not just preview
  }, null, 2));
  
  console.log(`Results saved to ${resultsPath}`);
  
  // Upload to Supabase
  if (products.length > 0) {
    await uploadToSupabase(products);
  }
  
  // Print summary by category
  const byCategory = {};
  for (const p of products) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }
  console.log("\nBy category:", byCategory);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
