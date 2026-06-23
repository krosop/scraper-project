/**
 * Deal Finder DZ — Multi-Site Scraper v2
 * Uses sitemap JSON for per-site CSS selectors
 * Scrapes 35 Algerian PC stores via category pages with pagination
 */

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// ─── Load Sitemap ───
const sitemap = JSON.parse(fs.readFileSync(path.join(__dirname, "sitemap.json"), "utf-8"));

// ─── Config ───
const http = axios.create({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

// ─── Price Parser (handles multiple Algerian formats) ───
function parsePrice(text) {
  if (!text) return null;
  let cleaned = text.toString()
    .replace(/د\.ج/g, "")
    .replace(/DZD/gi, "")
    .replace(/DA\b/gi, "")
    .replace(/Dinar/gi, "")
    .replace(/Prix/gi, "")
    .replace(/,/g, "")
    .trim();

  // European: "129.000,00" -> 129000
  const euroMatch = cleaned.match(/(\d{1,3}(?:\.\d{3})+)(?:,\d+)?/);
  if (euroMatch) return parseInt(euroMatch[1].replace(/\./g, ""));

  // Space-separated: "129 000" -> 129000
  const spaceMatch = cleaned.match(/(\d{1,3}(?:\s+\d{3})+)/);
  if (spaceMatch) return parseInt(spaceMatch[1].replace(/\s/g, ""));

  // Plain: "39000"
  const plainMatch = cleaned.match(/(\d{3,})/);
  if (plainMatch) return parseInt(plainMatch[1]);

  return null;
}

// ─── Category Inference ───
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

// ─── Generic Site Scraper ───
async function scrapeSite(siteDef, maxPages = 1) {
  const items = [];
  const s = siteDef.selectors || {};
  const baseUrl = siteDef.base_url;

  // Determine which URLs to scrape
  let urlsToScrape = [];

  if (siteDef.urls?.categories && siteDef.urls.categories.length > 0) {
    // Scrape category pages
    for (const cat of siteDef.urls.categories.slice(0, 4)) { // limit to 4 categories
      urlsToScrape.push(`${baseUrl}${cat}`);
    }
  } else if (siteDef.urls?.shop) {
    urlsToScrape.push(`${baseUrl}${siteDef.urls.shop}`);
  } else {
    urlsToScrape.push(baseUrl);
  }

  for (const url of urlsToScrape) {
    let pageUrls = [url];

    // Add pagination pages
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
        await new Promise(r => setTimeout(r, (siteDef.crawl_delay || 2) * 1000));

        const { data: html } = await http.get(pageUrl);
        const $ = cheerio.load(html);

        // Check for anti-bot
        const title = $("title").text().trim();
        if (title.includes("Cloudflare") || title.includes("Loader") || title.includes("challenge")) {
          console.log(`  [${siteDef.name}] BLOCKED at ${pageUrl}`);
          break;
        }

        // Find products using selectors
        const productSelector = s.product_list || ".product";
        const nameSelector = s.product_name || ".woocommerce-loop-product__title, h2, h3, .product-title, .product-name";
        const priceSelector = s.product_price || ".price bdi, .price .amount, .price, .woocommerce-Price-amount";
        const linkSelector = s.product_link || "a";

        $(productSelector).each((_, el) => {
          const $el = $(el);
          const titleEl = $el.find(nameSelector).first();
          let title = titleEl.text().trim();

          // Fallback: try any link with substantial text
          if (!title || title.length < 3) {
            title = $el.find("a").filter((_, a) => $(a).text().trim().length > 5).first().text().trim();
          }

          const priceText = $el.find(priceSelector).first().text().trim();
          const price = parsePrice(priceText);
          let url = $el.find(linkSelector).first().attr("href") || "";
          if (url && !url.startsWith("http")) url = `${baseUrl}${url}`;

          // Skip if no title or price too low
          if (title && title.length > 3 && price && price >= 1000) {
            items.push({
              source: siteDef.name,
              title: title.substring(0, 120),
              price,
              url,
              category: inferCategory(title),
              location: inferLocation(siteDef.domain),
              condition: title.toLowerCase().includes("used") || title.toLowerCase().includes("occasion") ? "used" : "new",
            });
          }
        });

      } catch (e) {
        if (e.response?.status === 404) {
          // Pagination doesn't exist, stop
          break;
        }
        // Continue to next page
      }
    }
  }

  return items;
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

// ─── Supabase Upload ───
async function uploadToSupabase(products) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) return 0;

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
    for (const item of products) {
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
        is_available: true,
        status: "fresh",
        scraped_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "product_id,source_id,url" });

      inserted++;
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
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  DEAL FINDER DZ — MULTI-SITE SCRAPER v2");
  console.log(`  Sitemap: ${sitemap._meta.total_sites} sites | ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const t0 = Date.now();
  const allProducts = [];
  const stats = {};

  // Sort by priority (1 = highest)
  const sortedSites = sitemap.sites
    .filter(s => !s.anti_scraping?.captcha) // skip captcha sites for now
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  console.log(`Testing ${sortedSites.length} sites (skipped ${sitemap.sites.length - sortedSites.length} with captcha)\n`);

  for (const site of sortedSites) {
    try {
      process.stdout.write(`[${site.name.padEnd(25)}] `);
      const items = await scrapeSite(site, 1); // 1 page per category
      allProducts.push(...items);
      stats[site.name] = items.length;

      if (items.length > 0) {
        console.log(`${String(items.length).padStart(3)} products ${"OK"}`);
      } else {
        console.log(`  0 products (no data or blocked)`);
      }
    } catch (e) {
      stats[site.name] = 0;
      console.log(`ERROR: ${e.message}`);
    }
  }

  const duration = ((Date.now() - t0) / 1000).toFixed(1);

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════════");

  const workingSites = Object.entries(stats).filter(([_, c]) => c > 0);
  const emptySites = Object.entries(stats).filter(([_, c]) => c === 0);

  console.log(`\nWorking sites (${workingSites.length}):`);
  for (const [name, count] of workingSites.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(25)} ${String(count).padStart(3)} products`);
  }

  if (emptySites.length > 0) {
    console.log(`\nEmpty/blocked (${emptySites.length}): ${emptySites.map(([n]) => n).join(", ")}`);
  }

  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`  TOTAL: ${allProducts.length} products from ${workingSites.length} sites in ${duration}s`);
  console.log("═══════════════════════════════════════════════════════════");

  // Top 10 cheapest
  if (allProducts.length > 0) {
    console.log("\nTop 10 cheapest:");
    allProducts.sort((a, b) => a.price - b.price);
    allProducts.slice(0, 10).forEach((p, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${p.price.toString().padStart(7)} DZD  ${p.title.substring(0, 50)}  (${p.source})`);
    });
  }

  // Supabase upload
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    await uploadToSupabase(allProducts);
  }

  // Save JSON
  const output = {
    timestamp: new Date().toISOString(),
    duration,
    total: allProducts.length,
    siteCount: workingSites.length,
    bySite: stats,
    products: allProducts,
  };
  fs.writeFileSync(path.join(__dirname, "scrape-results.json"), JSON.stringify(output, null, 2));
  console.log("\nSaved to scripts/scrape-results.json");
}

if (require.main === module) {
  main().catch(e => { console.error("Fatal:", e); process.exit(1); });
}

module.exports = { scrapeSite, parsePrice, inferCategory };
