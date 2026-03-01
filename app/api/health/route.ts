import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const basicTest = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };

    let supabaseTest: Record<string, unknown> = { status: 'not_configured' };

    if (isSupabaseAdminConfigured()) {
      try {
        const { fetchSupabaseDataWithRetry } = await import('@/lib/supabaseAdmin');
        const { data, error } = await fetchSupabaseDataWithRetry(
          (client: any) => client.from('provinces').select('province_code, province_name').limit(1),
          'provinces'
        );

        supabaseTest = error
          ? { status: 'error', message: error.message }
          : { status: 'ok', sampleData: data };
      } catch (supabaseError: any) {
        supabaseTest = { status: 'error', message: supabaseError.message };
      }
    }

    return NextResponse.json({
      ...basicTest,
      supabase: supabaseTest,
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasOpenWeatherKey: !!process.env.OPENWEATHER_API_KEY,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
