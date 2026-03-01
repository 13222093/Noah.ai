import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured } from '@/lib/supabase/server';
import { EvacuationLocation } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { data, error } = await supabaseAdmin.from('evacuation_locations').select('*');

    if (error) {
      console.error('[API Evakuasi] Supabase error:', error);
      return NextResponse.json([], { status: 200 });
    }

    const mockedData: EvacuationLocation[] = (data ?? []).map((item: any) => ({
      ...item,
      operational_status: (['Buka', 'Penuh', 'Tutup Sementara', 'Buka dan Menerima Pengungsi'])[Math.floor(Math.random() * 4)],
      essential_services: {
        clean_water: (['Tersedia', 'Terbatas', 'Tidak Tersedia'])[Math.floor(Math.random() * 3)],
        electricity: (['Tersedia', 'Terbatas', 'Tidak Tersedia'])[Math.floor(Math.random() * 3)],
        medical_support: (['Tersedia 24 Jam', 'Tersedia', 'Tidak Tersedia'])[Math.floor(Math.random() * 3)],
      },
      verified_by: (['BPBD DKI Jakarta', 'Palang Merah Indonesia', 'BNPB'])[Math.floor(Math.random() * 3)],
    }));

    return NextResponse.json(mockedData, { status: 200 });
  } catch (error: any) {
    console.error('[API Evakuasi] Error:', error.message);
    return NextResponse.json([], { status: 200 });
  }
}
