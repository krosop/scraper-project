import { relations } from "drizzle-orm";
import {
  products,
  sources,
  listings,
  priceHistory,
  sellers,
  sellerListings,
} from "./schema";

export const productsRelations = relations(products, ({ many }) => ({
  listings: many(listings),
  priceHistory: many(priceHistory),
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
  listings: many(listings),
  priceHistory: many(priceHistory),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  product: one(products, {
    fields: [listings.productId],
    references: [products.id],
  }),
  source: one(sources, {
    fields: [listings.sourceId],
    references: [sources.id],
  }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  product: one(products, {
    fields: [priceHistory.productId],
    references: [products.id],
  }),
  source: one(sources, {
    fields: [priceHistory.sourceId],
    references: [sources.id],
  }),
}));

export const sellersRelations = relations(sellers, ({ many }) => ({
  listings: many(sellerListings),
}));

export const sellerListingsRelations = relations(sellerListings, ({ one }) => ({
  seller: one(sellers, {
    fields: [sellerListings.sellerId],
    references: [sellers.id],
  }),
}));
