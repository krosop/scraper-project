import { Hono } from "hono";
import { handle } from "@hono/node-server/vercel";

let app: any;
let error: any;

try {
  const mod = await import("./app-wrapper");
  app = mod.app;
} catch (e: any) {
  error = e;
}

const fallbackApp = new Hono();
fallbackApp.all("/api/*", (c) => {
  return c.json(
    {
      error: error?.message || "Unknown error",
      stack: error?.stack?.split("\n").slice(0, 10),
    },
    500
  );
});

export default handle(app || fallbackApp);
