import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { products, listings, sources, searchCache, searchLogs } from "@db/schema";
import { eq, and, gte, sql, desc, ilike } from "drizzle-orm";
import {
  searchStaticProducts,
  getStaticTrending,
} from "../data/staticData";

export const searchRouter = createRouter({
  // Main search endpoint
  search: publicQuery
    .input(
      z.object({
        q: z.string().min(1).max(100),
        category: z
          .enum(["all", "pc_part", "laptop", "accessory", "monitor"])
          .optional()
          .default("all"),
      })
    )
    .query(async ({ input }) => {
      const startTime = Date.now();
      const normalizedQuery = input.q.toLowerCase().trim();

      // Try database first
      try {
        const db = getDb();

        // 1. Check exact cache match
        const exactCache = await db
          .select()
          .from(searchCache)
          .where(
            and(
              eq(searchCache.queryNormalized, normalizedQuery),
              gte(searchCache.expiresAt, new Date())
            )
          )
          .limit(1);

        if (exactCache.length > 0) {
          await db
            .update(searchCache)
            .set({ hitCount: (exactCache[0].hitCount || 0) + 1 })
            .where(eq(searchCache.id, exactCache[0].id));

          await db.insert(searchLogs).values({
            rawQuery: input.q,
            normalizedQuery,
            cacheHit: true,
            responseTimeMs: Date.now() - startTime,
            resultsCount: Array.isArray(exactCache[0].resultsJson)
              ? (exactCache[0].resultsJson as any[]).length
              : 0,
          });

          return {
            fromCache: true,
            cacheType: "exact",
            results: exactCache[0].resultsJson as any[],
            query: input.q,
          };
        }

        // 2. Search products by name
        let productQuery;
        if (input.category !== "all") {
          productQuery = db
            .select()
            .from(products)
            .where(
              and(
                ilike(products.canonicalName, `%${normalizedQuery}%`),
                eq(products.category, input.category)
              )
            )
            .limit(20);
        } else {
          productQuery = db
            .select()
            .from(products)
            .where(ilike(products.canonicalName, `%${normalizedQuery}%`))
            .limit(20);
        }

        const matchedProducts = await productQuery;

        // 3. Get listings for matched products
        const results = await Promise.all(
          matchedProducts.map(async (product) => {
            const productListings = await db
              .select({
                listing: listings,
                source: sources,
              })
              .from(listings)
              .leftJoin(sources, eq(listings.sourceId, sources.id))
              .where(
                and(
                  eq(listings.productId, product.id),
                  eq(listings.isAvailable, true),
                  gte(listings.expiresAt, new Date())
                )
              )
              .orderBy(listings.price);

            if (productListings.length === 0) return null;

            const bestListing = productListings[0];

            return {
              product: {
                id: product.id,
                name: product.canonicalName,
                category: product.category,
                brand: product.brand,
                model: product.model,
                specs: product.specs,
                imageUrl:
                  product.storeImageUrl || product.fallbackImageUrl || null,
              },
              listingCount: productListings.length,
              bestPrice: bestListing.listing.price,
              bestStore: bestListing.source?.name || "Unknown",
              bestLocation: bestListing.listing.location,
              bestCondition: bestListing.listing.condition,
              allListings: productListings.map((pl) => ({
                id: pl.listing.id,
                price: pl.listing.price,
                condition: pl.listing.condition,
                location: pl.listing.location,
                url: pl.listing.url,
                sourceName: pl.source?.name || "Unknown",
                sourceType: pl.source?.scrapeType || "unknown",
                scrapedAt: pl.listing.scrapedAt,
                expiresAt: pl.listing.expiresAt,
                imageUrl: pl.listing.imageUrl,
              })),
            };
          })
        );

        const filteredResults = results.filter(Boolean) as any[];

        // 4. Store in cache
        if (filteredResults.length > 0) {
          await db.insert(searchCache).values({
            queryNormalized: normalizedQuery,
            category: input.category === "all" ? null : input.category,
            resultsJson: filteredResults as any,
            sourceList: [
              ...new Set(
                filteredResults.flatMap((r) =>
                  r.allListings.map((l: any) => l.sourceName)
                )
              ),
            ],
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }

        // Log search
        await db.insert(searchLogs).values({
          rawQuery: input.q,
          normalizedQuery,
          cacheHit: false,
          responseTimeMs: Date.now() - startTime,
          resultsCount: filteredResults.length,
        });

        if (filteredResults.length > 0) {
          return {
            fromCache: false,
            cacheType: null,
            results: filteredResults,
            query: input.q,
          };
        }
        // Fall through to static data if no DB results
      } catch {
        // Database unavailable, fall back to static data
      }

      // Static data fallback
      const staticResults = searchStaticProducts(input.q, input.category);

      return {
        fromCache: false,
        cacheType: "static",
        results: staticResults.map((p) => ({
          product: {
            id: p.id,
            name: p.canonicalName,
            category: p.category,
            brand: p.brand,
            model: p.model,
            specs: p.specs,
            imageUrl: p.imageUrl,
          },
          listingCount: p.listingCount,
          bestPrice: p.bestPrice,
          bestStore: p.listings[0]?.sourceName || "Unknown",
          bestLocation: p.listings[0]?.location || "Algeria",
          bestCondition: p.listings[0]?.condition || "new",
          allListings: p.listings,
        })),
        query: input.q,
      };
    }),

  // Get trending searches
  trending: publicQuery.query(async () => {
    try {
      const db = getDb();
      const trending = await db
        .select({
          query: searchLogs.normalizedQuery,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(searchLogs)
        .where(
          gte(
            searchLogs.createdAt,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          )
        )
        .groupBy(searchLogs.normalizedQuery)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      if (trending.length > 0) return trending;
    } catch {
      // DB unavailable
    }

    return getStaticTrending();
  }),
});
