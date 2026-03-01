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
      .from('historical_incidents')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message);
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json([]);
  }
}
