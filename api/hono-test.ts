import { Hono } from "hono";

const app = new Hono();
app.get("/api/hono-test", (c) => c.json({ ok: true, from: "hono" }));

export default async function handler(req: Request) {
  return app.fetch(req);
}
