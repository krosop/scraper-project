import { getRequestListener } from "@hono/node-server";
import { app } from "../server/app";

// Vercel serverless entry — all env vars loaded at runtime
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
