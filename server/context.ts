import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { supabase } from "./lib/supabase";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  supabase: typeof supabase;
};

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    supabase,
  };
}
