import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { sources, searchLogs } from "@db/schema";
import { sql } from "drizzle-orm";
import { getSources } from "../data/staticData";

export const scrapeRouter = createRouter({
  // Get scrape status
  status: publicQuery.query(async () => {
    try {
      const db = getDb();

      const sourceStatuses = await db
        .select({
          name: sources.name,
          lastScrapedAt: sources.lastScrapedAt,
          isActive: sources.isActive,
          scrapeType: sources.scrapeType,
        })
        .from(sources)
        .orderBy(sources.name);

      // Get today's search count
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const searchStats = await db
        .select({
          totalSearches: sql<number>`count(*)`.as("total_searches"),
          cacheHits: sql<number>`sum(case when ${searchLogs.cacheHit} then 1 else 0 end)`.as(
            "cache_hits"
          ),
        })
        .from(searchLogs)
        .where(sql`${searchLogs.createdAt} >= ${today}`);

      return {
        sources: sourceStatuses,
        searchStats: searchStats[0] || { totalSearches: 0, cacheHits: 0 },
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      // DB unavailable, return static data
      const staticSources = getSources();
      return {
        sources: staticSources.map((s) => ({
          name: s.name,
          lastScrapedAt: new Date().toISOString(),
          isActive: s.isActive,
          scrapeType: "axios" as const,
        })),
        searchStats: { totalSearches: 0, cacheHits: 0 },
        lastUpdated: new Date().toISOString(),
      };
    }
  }),

  // Get search stats for last 7 days
  stats: publicQuery.query(async () => {
    try {
      const db = getDb();

      const dailyStats = await db
        .select({
          date: sql<string>`date(${searchLogs.createdAt})`.as("date"),
          searches: sql<number>`count(*)`.as("searches"),
          cacheHitRate:
            sql<number>`round(avg(case when ${searchLogs.cacheHit} then 1.0 else 0.0 end) * 100, 1)`.as(
              "cache_hit_rate"
            ),
          avgResponseTime: sql<number>`round(avg(${searchLogs.responseTimeMs}), 0)`.as(
            "avg_response_time"
          ),
        })
        .from(searchLogs)
        .where(sql`${searchLogs.createdAt} >= now() - interval '7 days'`)
        .groupBy(sql`date(${searchLogs.createdAt})`)
        .orderBy(sql`date(${searchLogs.createdAt})`);

      return dailyStats;
    } catch {
      // DB unavailable, return empty stats
      return [];
    }
  }),
});
