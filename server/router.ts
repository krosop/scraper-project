import { createRouter, publicQuery } from "./middleware";
import { searchRouter } from "./routers/search";
import { productRouter } from "./routers/product";
import { sellerRouter } from "./routers/seller";
import { scrapeRouter } from "./routers/scrape";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  search: searchRouter,
  product: productRouter,
  seller: sellerRouter,
  scrape: scrapeRouter,
});

export type AppRouter = typeof appRouter;
