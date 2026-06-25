import { Hono } from "hono";
import { handle } from "@hono/node-server/vercel";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ ok: true, framework: "hono", time: Date.now() });
});

export default handle(app);
