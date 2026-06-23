import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  serial,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const categoryEnum = pgEnum("category", [
  "phone",
  "pc_part",
  "laptop",
  "accessory",
  "monitor",
]);

export const scrapeTypeEnum = pgEnum("scrape_type", ["axios", "playwright"]);

export const conditionEnum = pgEnum("condition", [
  "new",
  "used",
  "refurbished",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "fresh",
  "stale",
  "expired",
]);

// Products (canonical catalog)
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalName: text("canonical_name").notNull(),
    category: categoryEnum("category"),
    brand: text("brand"),
    model: text("model"),
    specs: jsonb("specs").default({}),
    storeImageUrl: text("store_image_url"),
    fallbackImageUrl: text("fallback_image_url"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_products_name_trgm").on(table.canonicalName),
    index("idx_products_category").on(table.category),
  ]
);

// Sources (websites we scrape)
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  baseUrl: text("base_url").notNull(),
  scrapeType: scrapeTypeEnum("scrape_type"),
  categoryFocus: text("category_focus").array(),
  isActive: boolean("is_active").default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
});

// Listings (raw scraped data)
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id),
    sourceId: uuid("source_id").references(() => sources.id),
    externalId: text("external_id"),
    title: text("title").notNull(),
    price: integer("price").notNull(), // stored in DZD (185000 = 185 000 DZD)
    currency: text("currency").default("DZD"),
    condition: conditionEnum("condition").default("new"),
    location: text("location"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").default(true),
    status: listingStatusEnum("status").default("fresh"),
    scrapedAt: timestamp("scraped_at").defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("idx_listings_product").on(table.productId, table.price),
    index("idx_listings_source").on(
      table.sourceId,
      table.isAvailable,
      table.expiresAt
    ),
    index("idx_listings_expires").on(table.expiresAt),
    index("idx_listings_available").on(table.isAvailable),
  ]
);

// Search Cache (the brain)
export const searchCache = pgTable(
  "search_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryNormalized: text("query_normalized").notNull().unique(),
    queryEmbedding: text("query_embedding"),
    category: text("category"),
    resultsJson: jsonb("results_json").notNull(),
    sourceList: text("source_list").array(),
    hitCount: integer("hit_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    uniqueIndex("idx_cache_query").on(table.queryNormalized),
    index("idx_cache_expires").on(table.expiresAt),
  ]
);

// Bing Image Cache (fallback images)
export const bingImageCache = pgTable(
  "bing_image_cache",
  {
    id: serial("id").primaryKey(),
    queryNormalized: text("query_normalized").notNull().unique(),
    imageUrl: text("image_url").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow(),
  },
  (table) => [uniqueIndex("idx_bing_query").on(table.queryNormalized)]
);

// Price History (for analytics, keep small)
export const priceHistory = pgTable("price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id),
  sourceId: uuid("source_id").references(() => sources.id),
  price: integer("price"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Sellers (manual dashboard)
export const sellers = pgTable("sellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeName: text("store_name").notNull(),
  wilaya: text("wilaya").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Seller Listings
export const sellerListings = pgTable(
  "seller_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .references(() => sellers.id)
      .notNull(),
    productName: text("product_name").notNull(),
    category: text("category"),
    price: integer("price").notNull(),
    condition: text("condition").default("new"),
    description: text("description"),
    imageUrls: text("image_urls").array(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("idx_seller_listings_seller").on(table.sellerId),
    index("idx_seller_listings_active").on(table.isActive, table.expiresAt),
  ]
);

// Search Logs (analytics)
export const searchLogs = pgTable("search_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  rawQuery: text("raw_query"),
  normalizedQuery: text("normalized_query"),
  cacheHit: boolean("cache_hit"),
  responseTimeMs: integer("response_time_ms"),
  resultsCount: integer("results_count"),
  createdAt: timestamp("created_at").defaultNow(),
});
