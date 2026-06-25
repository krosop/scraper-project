import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

let _client: any = null;

export function getSupabase() {
  if (!_client) {
    _client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false },
      realtime: { enabled: false }
    });
  }
  return _client;
}

// Backwards-compatible export (lazy)
export const supabase = new Proxy({} as any, {
  get(_, prop) {
    return getSupabase()[prop];
  }
});
