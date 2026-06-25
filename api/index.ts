import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.get("/api/trpc/ping", (c) => c.json({ ok: true, ts: Date.now() }));

export default getRequestListener(app);
