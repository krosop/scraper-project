import { handle } from "@hono/node-server/vercel";
import { Hono } from "hono";

const app = new Hono();
app.get("/api/trpc/ping", (c) => c.json({ ok: true, ts: Date.now() }));

export default handle(app);
