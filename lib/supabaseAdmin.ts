import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or Service Role Key environment variables.');
  _client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

export const supabaseServiceRole = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Generic function to fetch data from Supabase with retry logic
export async function fetchSupabaseDataWithRetry<T>(
  queryFunction: (client: any) => PromiseLike<{ data: T | null; error: any }>,
  tableName: string, // For logging purposes
  retries = 3,
  delay = 1000, // 1 second delay
): Promise<{ data: T | null; error: any }> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await queryFunction(supabaseServiceRole);
      if (error) {
        console.error(`Error fetching from ${tableName} (attempt ${i + 1}):`, error.message);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        return { data, error: null };
      }
    } catch (e: any) {
      console.error(`Exception fetching from ${tableName} (attempt ${i + 1}):`, e.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return { data: null, error: e };
      }
    }
  }
  return { data: null, error: new Error(`Failed to fetch from ${tableName} after ${retries} attempts.`) };
}
