import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured } from '@/lib/supabase/server';
import { FloodReportSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { data, error } = await supabaseAdmin
      .from('laporan_banjir')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json([]);
    }
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: 'Database is not configured.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const validationResult = FloodReportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { errors: validationResult.error.issues, message: 'Data input tidak valid.' },
        { status: 400 }
      );
    }

    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { error: insertError } = await supabaseAdmin
      .from('laporan_banjir')
      .insert([validationResult.data]);

    if (insertError) {
      console.error('Error inserting report:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Laporan berhasil diterima.' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: `Internal server error: ${(error as Error).message}` }, { status: 500 });
  }
}

