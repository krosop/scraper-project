export default async function handler(req: Request) {
  const results: string[] = [];
  
  try {
    const { Hono } = await import("hono");
    results.push("hono: ok");
  } catch (e: any) {
    results.push("hono: FAIL - " + e.message);
  }
  
  try {
    const { bodyLimit } = await import("hono/body-limit");
    results.push("hono/body-limit: ok");
  } catch (e: any) {
    results.push("hono/body-limit: FAIL - " + e.message);
  }
  
  try {
    const { HttpBindings } = await import("@hono/node-server");
    results.push("@hono/node-server: ok");
  } catch (e: any) {
    results.push("@hono/node-server: FAIL - " + e.message);
  }
  
  try {
    const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
    results.push("@trpc/server/adapters/fetch: ok");
  } catch (e: any) {
    results.push("@trpc/server/adapters/fetch: FAIL - " + e.message);
  }
  
  try {
    const router = await import("../server/router");
    results.push("../server/router: ok");
  } catch (e: any) {
    results.push("../server/router: FAIL - " + e.message);
  }
  
  try {
    const context = await import("../server/context");
    results.push("../server/context: ok");
  } catch (e: any) {
    results.push("../server/context: FAIL - " + e.message);
  }
  
  try {
    const app = await import("../server/app");
    results.push("../server/app: ok");
  } catch (e: any) {
    results.push("../server/app: FAIL - " + e.message);
  }
  
  return new Response(JSON.stringify({ results, env: process.env.NODE_ENV }, null, 2), {
    headers: { "content-type": "application/json" }
  });
}
