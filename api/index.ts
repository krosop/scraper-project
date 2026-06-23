import { getRequestListener } from "@hono/node-server";
import { app } from "../server/app";

export default getRequestListener(app);
