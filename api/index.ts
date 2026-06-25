import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.get("/api/trpc/ping", (c) => c.json({ ok: true, ts: Date.now() }));

const handler = getRequestListener(app);

export default function (req: any, res: any) {
  try {
    return handler(req, res);
  } catch (err: any) {
    console.error("[API CRASH]", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || "Unknown error", stack: err?.stack }));
  }
}
