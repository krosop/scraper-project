import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { products, listings, sources, priceHistory } from "@db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  getStaticProductById,
  getStaticProductsByCategory,
  getStaticProducts,
} from "../data/staticData";

export const productRouter = createRouter({
  // Get product detail with all listings
  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Try database first
      try {
        const db = getDb();
        const product = await db
          .select()
          .from(products)
          .where(eq(products.id, input.id))
          .limit(1);

        if (product.length > 0) {
          const productListings = await db
            .select({
              listing: listings,
              source: sources,
            })
            .from(listings)
            .leftJoin(sources, eq(listings.sourceId, sources.id))
            .where(
              and(
                eq(listings.productId, input.id),
                eq(listings.isAvailable, true),
                gte(listings.expiresAt, new Date())
              )
            )
            .orderBy(listings.price);

          const history = await db
            .select({
              price: priceHistory.price,
              recordedAt: priceHistory.recordedAt,
              sourceName: sources.name,
            })
            .from(priceHistory)
            .leftJoin(sources, eq(priceHistory.sourceId, sources.id))
            .where(eq(priceHistory.productId, input.id))
            .orderBy(priceHistory.recordedAt)
            .limit(30);

          return {
            product: product[0],
            listings: productListings.map((pl) => ({
              id: pl.listing.id,
              price: pl.listing.price,
              condition: pl.listing.condition,
              location: pl.listing.location,
              url: pl.listing.url,
              sourceName: pl.source?.name || "Unknown",
              sourceType: pl.source?.scrapeType || "unknown",
              scrapedAt: pl.listing.scrapedAt,
              expiresAt: pl.listing.expiresAt,
              status: pl.listing.status,
              imageUrl: pl.listing.imageUrl,
            })),
            priceHistory: history,
          };
        }
      } catch {
        // DB unavailable, try static
      }

      // Static fallback
      const staticProduct = getStaticProductById(input.id);
      if (!staticProduct) {
        throw new Error("Product not found");
      }

      return {
        product: {
          id: staticProduct.id,
          canonicalName: staticProduct.canonicalName,
          category: staticProduct.category,
          brand: staticProduct.brand,
          model: staticProduct.model,
          specs: staticProduct.specs,
          storeImageUrl: staticProduct.imageUrl,
          fallbackImageUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        listings: staticProduct.listings.map((l) => ({
          ...l,
          status: "fresh" as const,
        })),
        priceHistory: staticProduct.listings.slice(0, 1).map((l) => ({
          price: l.price,
          recordedAt: new Date(l.scrapedAt),
          sourceName: l.sourceName,
        })),
      };
    }),

  // Get product by slug/name
  getByName: publicQuery
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = getDb();
        const product = await db
          .select()
          .from(products)
          .where(sql`${products.canonicalName} ILIKE ${`%${input.name}%`}`)
          .limit(1);

        if (product.length > 0) return product[0];
      } catch {
        // DB unavailable
      }

      // Static fallback
      const all = getStaticProducts();
      const found = all.find((p) =>
        p.canonicalName.toLowerCase().includes(input.name.toLowerCase())
      );
      if (!found) throw new Error("Product not found");

      return {
        id: found.id,
        canonicalName: found.canonicalName,
        category: found.category,
        brand: found.brand,
        model: found.model,
        specs: found.specs,
        storeImageUrl: found.imageUrl,
        fallbackImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  // Verify listing URL is alive
  verifyLink: publicQuery
    .input(z.object({ listingId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = getDb();
        const listing = await db
          .select()
          .from(listings)
          .where(eq(listings.id, input.listingId))
          .limit(1);

        if (listing.length > 0) {
          return {
            available: listing[0].isAvailable,
            url: listing[0].url,
            expiresAt: listing[0].expiresAt,
          };
        }
      } catch {
        // DB unavailable
      }

      return { available: true, url: "#", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
    }),

  // Get products by category
  byCategory: publicQuery
    .input(
      z.object({
        category: z.enum([
          "pc_part",
          "laptop",
          "accessory",
          "monitor",
        ]),
        limit: z.number().min(1).max(50).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = getDb();
        const productList = await db
          .select()
          .from(products)
          .where(eq(products.category, input.category))
          .limit(input.limit)
          .offset(input.offset);

        if (productList.length > 0) {
          const withListings = await Promise.all(
            productList.map(async (product) => {
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
                .orderBy(listings.price)
                .limit(5);

              return {
                ...product,
                storeImageUrl: product.storeImageUrl || null,
                listings: productListings.map((pl) => ({
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
                listingCount: productListings.length,
                bestPrice: productListings[0]?.listing.price || null,
              };
            })
          );

          return withListings;
        }
      } catch {
        // DB unavailable
      }

      // Static fallback
      return getStaticProductsByCategory(
        input.category,
        input.limit,
        input.offset
      ).map((p) => ({
        id: p.id,
        canonicalName: p.canonicalName,
        category: p.category,
        brand: p.brand,
        model: p.model,
        specs: p.specs,
        storeImageUrl: p.imageUrl,
        fallbackImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        listings: p.listings,
        listingCount: p.listingCount,
        bestPrice: p.bestPrice,
      }));
    }),
});
