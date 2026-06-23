/**
 * Deal Finder DZ — Final Production Scraper
 * Fixed price parsing for Algerian formats
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync } from "fs";

const http = axios.create({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "text/html,*/*;q=0.8",
  },
});

function log(s, m) { console.log(`[${s}] ${m}`); }

// Parse Algerian price: "د.ج 129.000,00" or "129 000 DZD" or "39000"
function parsePrice(text) {
  if (!text) return null;
  // Remove currency symbols and whitespace
  let cleaned = text
    .replace(/د\.ج/g, "")
    .replace(/DZD/gi, "")
    .replace(/DA/gi, "")
    .replace(/Dinar/gi, "")
    .trim();

  // Match European format: "129.000,00" -> 129000
  const euroMatch = cleaned.match(/(\d{1,3}(?:\.\d{3})+)(?:,\d+)?/);
  if (euroMatch) {
    return parseInt(euroMatch[1].replace(/\./g, ""));
  }

  // Match space-separated: "129 000" -> 129000
  const spaceMatch = cleaned.match(/(\d{1,3}(?:\s+\d{3})+)/);
  if (spaceMatch) {
    return parseInt(spaceMatch[1].replace(/\s/g, ""));
  }

  // Plain number: "39000"
  const plainMatch = cleaned.match(/(\d{3,})/);
  if (plainMatch) {
    return parseInt(plainMatch[1]);
  }

  return null;
}

// ═══ KOTEK ═══
async function scrapeKOTEK() {
  log("KOTEK", "=== SCRAPING ===");
  const items = [];

  try {
    const { data: html } = await http.get("https://kotekdz.com");
    const $ = cheerio.load(html);

    $(".product").each((_, el) => {
      const $el = $(el);
      const title = $el.find(".woocommerce-loop-product__title, .product-loop-title, h3").first().text().trim();
      const priceText = $el.find(".price bdi, .price .amount").first().text().trim();
      const price = parsePrice(priceText);
      const url = $el.find("a").first().attr("href") || "";

      if (title && price && price > 1000) {
        items.push({
          source: "KOTEK Informatique",
          title: title.substring(0, 100),
          price,
          url,
          category: inferCategory(title),
          location: "Alger",
        });
      }
    });

    log("KOTEK", `Extracted ${items.length} products`);
    items.slice(0, 8).forEach((it, i) => {
      log("KOTEK", `  ${String(i+1).padStart(2)}. ${it.title.substring(0, 52).padEnd(52)} ${String(it.price).padStart(7)} DZD`);
    });
  } catch (e) {
    log("KOTEK", `ERROR: ${e.message}`);
  }
  return items;
}

// ═══ MOBOLIST ═══
async function scrapeMobolist() {
  log("Mobolist", "=== SCRAPING ===");
  const items = [];

  try {
    const { data: html } = await http.get("https://mobolist.net/en/prices-list/algeria");
    const $ = cheerio.load(html);

    // Mobolist uses device-list-item structure
    $(".device-list-item").each((_, el) => {
      const $el = $(el);
      const name = $el.find(".device-name").text().trim();
      const brand = $el.find(".device-brand").text().trim();

      // Find price - look for numbers near the device
      const priceEl = $el.find("[class*='price'], .price, .device-price").first();
      let priceText = priceEl.text().trim();

      // If no dedicated price class, search all text for DZD patterns
      if (!priceText) {
        priceText = $el.text().trim();
      }

      const price = parsePrice(priceText);
      const title = `${brand} ${name}`.trim();

      if (title.length > 3 && price && price > 1000) {
        items.push({
          source: "Mobolist",
          title,
          price,
          url: `https://mobolist.net/en/phone/${title.toLowerCase().replace(/\s+/g, "-")}`,
          category: "phone",
          location: "Algeria",
        });
      }
    });

    log("Mobolist", `Extracted ${items.length} phones`);
    items.slice(0, 8).forEach((it, i) => {
      log("Mobolist", `  ${String(i+1).padStart(2)}. ${it.title.substring(0, 52).padEnd(52)} ${String(it.price).padStart(7)} DZD`);
    });
  } catch (e) {
    log("Mobolist", `ERROR: ${e.message}`);
  }
  return items;
}

// ═══ GIGASTORE ═══
async function scrapeGigastore() {
  log("Gigastore", "=== SCRAPING ===");
  const items = [];

  try {
    const { data: html } = await http.get("https://gigastore-dz.com");
    const $ = cheerio.load(html);

    $(".product-card").each((_, el) => {
      const title = $(el).find(".product-card__title").text().trim();
      const priceText = $(el).find(".price, .money").text().trim();
      const price = parsePrice(priceText);
      const url = $(el).find("a").first().attr("href") || "";

      if (title && price && price > 1000) {
        items.push({
          source: "Gigastore DZ",
          title: title.substring(0, 100),
          price,
          url: url.startsWith("http") ? url : `https://gigastore-dz.com${url}`,
          category: inferCategory(title),
          location: "Alger",
        });
      }
    });

    log("Gigastore", `Extracted ${items.length} products`);
    items.slice(0, 5).forEach((it, i) => {
      log("Gigastore", `  ${i+1}. ${it.title.substring(0, 50)} - ${it.price} DZD`);
    });
  } catch (e) {
    log("Gigastore", `ERROR: ${e.message}`);
  }
  return items;
}

// ═══ WEBSTAR ELECTRO (phones) ═══
async function scrapeWebstar() {
  log("Webstar", "=== SCRAPING ===");
  const items = [];

  try {
    const { data: html } = await http.get("https://webstar-electro.com");
    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    log("Webstar", `Title: "${title.substring(0, 60)}"`);

    // Look for product elements
    $(".product, .item, .phone").each((_, el) => {
      const title = $(el).find("h2, h3, .title, .name").first().text().trim();
      const priceText = $(el).find(".price, .amount").text().trim();
      const price = parsePrice(priceText);

      if (title && price && price > 1000) {
        items.push({ source: "Webstar Electro", title, price, category: "phone", location: "Alger" });
      }
    });

    log("Webstar", `Extracted ${items.length} phones`);
  } catch (e) {
    log("Webstar", `ERROR: ${e.message}`);
  }
  return items;
}

// ═══ Helpers ═══
function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("iphone") || t.includes("samsung") || t.includes("xiaomi") || t.includes("phone")) return "phone";
  if (t.includes("rtx") || t.includes("gtx") || t.includes("rx ") || t.includes(" radeon ") || t.includes("carte graphique")) return "pc_part";
  if (t.includes("processeur") || t.includes("ryzen") || t.includes("core i")) return "pc_part";
  if (t.includes("ecran") || t.includes("monitor") || t.includes("moniteur")) return "monitor";
  if (t.includes("ram") || t.includes("ddr")) return "pc_part";
  if (t.includes("ssd") || t.includes("nvme")) return "pc_part";
  if (t.includes("laptop") || t.includes("pc portable")) return "laptop";
  if (t.includes("souris") || t.includes("clavier") || t.includes("headset")) return "accessory";
  return "pc_part";
}

// ═══ MAIN ═══
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  DEAL FINDER DZ — PRODUCTION SCRAPER TEST");
  console.log("═══════════════════════════════════════════════════\n");

  const t0 = Date.now();
  const kotek = await scrapeKOTEK();
  console.log("");
  const mobolist = await scrapeMobolist();
  console.log("");
  const gigastore = await scrapeGigastore();
  console.log("");
  const webstar = await scrapeWebstar();

  const all = [...kotek, ...mobolist, ...gigastore, ...webstar];
  const dur = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("═══════════════════════════════════════════════════");
  console.log(`  RESULTS: ${all.length} products in ${dur}s`);
  console.log("═══════════════════════════════════════════════════");
  console.log(`  KOTEK Informatique:  ${kotek.length} products`);
  console.log(`  Mobolist:            ${mobolist.length} phones`);
  console.log(`  Gigastore DZ:        ${gigastore.length} products`);
  console.log(`  Webstar Electro:     ${webstar.length} phones`);
  console.log(`  ────────────────────────────────────────────────`);
  console.log(`  TOTAL:               ${all.length} items`);
  console.log("═══════════════════════════════════════════════════");

  // Save results
  writeFileSync("scripts/scrape-results.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    duration: dur,
    stats: { kotek: kotek.length, mobolist: mobolist.length, gigastore: gigastore.length, webstar: webstar.length },
    total: all.length,
    products: all,
  }, null, 2));
  console.log("\nSaved to scripts/scrape-results.json");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
