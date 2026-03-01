import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API Alerts] Supabase error:', error);
      throw new Error(error.message);
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('[API Alerts] Error:', error);
    return NextResponse.json([]);
  }
}
