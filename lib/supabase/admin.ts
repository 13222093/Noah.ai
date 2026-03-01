import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or Service Role Key environment variables.');
  _admin = createClient(url, key);
  return _admin;
}

// IMPORTANT: Never expose this client to the browser. Lazy-init to avoid build failures when env vars are missing.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
