import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { sellers, sellerListings } from "../../db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export const sellerRouter = createRouter({
  // Register a new seller
  register: publicQuery
    .input(
      z.object({
        storeName: z.string().min(1).max(100),
        wilaya: z.string().min(1).max(50),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const result = await db
          .insert(sellers)
          .values({
            storeName: input.storeName,
            wilaya: input.wilaya,
            phone: input.phone,
            whatsapp: input.whatsapp,
            email: input.email,
          })
          .returning();
        return result[0];
      } catch {
        throw new Error("Database unavailable. Seller registration is currently disabled.");
      }
    }),

  // Get seller by ID
  getById: publicQuery
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();

      const seller = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, input.id))
        .limit(1);

      if (seller.length === 0) {
        throw new Error("Seller not found");
      }

      return seller[0];
    }),

  // Create a seller listing
  createListing: publicQuery
    .input(
      z.object({
        sellerId: z.string().uuid(),
        productName: z.string().min(1).max(200),
        category: z
          .enum(["phone", "pc_part", "laptop", "accessory", "monitor"])
          .optional(),
        price: z.number().min(0),
        condition: z.enum(["new", "used", "refurbished"]).default("new"),
        description: z.string().max(1000).optional(),
        imageUrls: z.array(z.string().url()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const result = await db
        .insert(sellerListings)
        .values({
          sellerId: input.sellerId,
          productName: input.productName,
          category: input.category,
          price: input.price,
          condition: input.condition,
          description: input.description,
          imageUrls: input.imageUrls,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      return result[0];
    }),

  // Get listings for a seller
  getListings: publicQuery
    .input(z.object({ sellerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();

      const listings = await db
        .select()
        .from(sellerListings)
        .where(eq(sellerListings.sellerId, input.sellerId))
        .orderBy(desc(sellerListings.createdAt));

      return listings;
    }),

  // Get all active seller listings (public)
  getActiveListings: publicQuery
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = getDb();

        const activeListings = await db
          .select({
            listing: sellerListings,
            seller: sellers,
          })
          .from(sellerListings)
          .leftJoin(sellers, eq(sellerListings.sellerId, sellers.id))
          .where(
            and(
              eq(sellerListings.isActive, true),
              gte(sellerListings.expiresAt, new Date())
            )
          )
          .orderBy(desc(sellerListings.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        return activeListings.map((al) => ({
          ...al.listing,
          sellerName: al.seller?.storeName || "Unknown",
          sellerWilaya: al.seller?.wilaya || "Unknown",
          sellerPhone: al.seller?.phone,
          sellerWhatsapp: al.seller?.whatsapp,
        }));
      } catch {
        // DB unavailable, return empty
        return [];
      }
    }),

  // Renew a listing (extend by 7 days)
  renewListing: publicQuery
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const result = await db
        .update(sellerListings)
        .set({
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(sellerListings.id, input.listingId))
        .returning();

      return result[0];
    }),

  // Deactivate a listing
  deactivateListing: publicQuery
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const result = await db
        .update(sellerListings)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(sellerListings.id, input.listingId))
        .returning();

      return result[0];
    }),
});
