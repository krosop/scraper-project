import { Hono } from "hono";
import { handle } from "@hono/node-server/vercel";

const app = new Hono();

app.get("/", async (c) => {
  const results: any = {
    step: "start",
    time: new Date().toISOString(),
    nodeVersion: process.version,
    cwd: process.cwd(),
  };

  const modules = [
    ["hono", () => import("hono")],
    ["@trpc/server", () => import("@trpc/server")],
    ["superjson", () => import("superjson")],
    ["zod", () => import("zod")],
    ["drizzle-orm", () => import("drizzle-orm")],
    ["drizzle-orm/pg-core", () => import("drizzle-orm/pg-core")],
    ["postgres", () => import("postgres")],
  ];

  for (const [name, importer] of modules) {
    try {
      await importer();
      results[`import_${name.replace(/[^a-z0-9]/g, "_")}`] = "OK";
    } catch (e: any) {
      results[`import_${name.replace(/[^a-z0-9]/g, "_")}`] = `FAIL: ${e.message}`;
      results.failedAt = name;
      return c.json(results);
    }
  }

  const ourModules = [
    ["server/lib/env", () => import("../server/lib/env")],
    ["server/lib/supabase", () => import("../server/lib/supabase")],
    ["db/schema", () => import("../../db/schema")],
    ["db/relations", () => import("../../db/relations")],
    ["server/queries/connection", () => import("../server/queries/connection")],
    ["server/middleware", () => import("../server/middleware")],
    ["server/router", () => import("../server/router")],
    ["server/app", () => import("../server/app")],
  ];

  for (const [name, importer] of ourModules) {
    try {
      await importer();
      results[`import_${name.replace(/[^a-z0-9]/g, "_")}`] = "OK";
    } catch (e: any) {
      results[`import_${name.replace(/[^a-z0-9]/g, "_")}`] = `FAIL: ${e.message}`;
      results.failedAt = name;
      return c.json(results);
    }
  }

  results.status = "ALL_OK";
  return c.json(results);
});

export default handle(app);
