import { getRequestListener } from "@hono/node-server";
import { app } from "../server/app";

// Vercel serverless entry — all env vars loaded at runtime
export default getRequestListener(app);
