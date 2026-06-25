import { Hono } from "hono";
import { handle } from "@hono/node-server/vercel";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ ok: true, framework: "hono-minimal", time: Date.now() });
});

export default handle(app);