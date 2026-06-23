/**
 * DZ Tech Hunt - Cleanup Script
 * Run after scraping to remove stale data
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  { auth: { persistSession: false }, realtime: { enabled: false } }
);

async function cleanup() {
  console.log("Starting cleanup...");
  const now = new Date().toISOString();

  // 1. Mark expired listings
  const { data: expired } = await supabase
    .from("listings")
    .update({
      is_available: false,
      status: "expired",
    })
    .lt("expires_at", now)
    .select("id");

  console.log(`Marked ${expired?.length || 0} listings as expired`);

  // 2. Mark stale listings (6-24h old)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("listings")
    .update({ status: "stale" })
    .lt("scraped_at", sixHoursAgo)
    .eq("is_available", true)
    .select("id");

  console.log(`Marked ${stale?.length || 0} listings as stale`);

  // 3. Archive old price history to keep table small
  const { error: archiveError } = await supabase
    .from("price_history")
    .delete()
    .lt("recorded_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (archiveError) {
    console.error("Archive error:", archiveError);
  } else {
    console.log("Archived old price history");
  }

  // 4. Expire old search cache
  const { data: cacheDeleted } = await supabase
    .from("search_cache")
    .delete()
    .lt("expires_at", now)
    .select("id");

  console.log(`Deleted ${cacheDeleted?.length || 0} expired cache entries`);

  // 5. Deactivate expired seller listings
  const { data: sellerExpired } = await supabase
    .from("seller_listings")
    .update({ is_active: false })
    .lt("expires_at", now)
    .eq("is_active", true)
    .select("id");

  console.log(`Deactivated ${sellerExpired?.length || 0} expired seller listings`);

  console.log("Cleanup complete!");
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
