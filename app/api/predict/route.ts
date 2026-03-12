import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/simple-rate-limit';

export async function POST(request: Request) {
  const ip = getClientIP(request.headers);
  const rl = checkRateLimit(`predict:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

  try {
    const requestBody = await request.json();
    const mode = requestBody.mode || 'manual';

    let payload = requestBody;

    // AUTO MODE: Fetch live data from water-level + rainfall-dual endpoints
    if (mode === 'auto') {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const [waterLevelRes, rainfallRes] = await Promise.all([
          fetch(`${baseUrl}/api/water-level`),
          fetch(`${baseUrl}/api/rainfall-dual`),
        ]);

        const waterLevelData = await waterLevelRes.json();
        const rainfallData = await rainfallRes.json();

        // Extract values from the responses
        const waterLevel = waterLevelData.current?.water_level_cm ?? 300;
        const rainfallBogor = rainfallData.rainfall_bogor ?? waterLevelData.current?.rainfall_bogor_mm ?? 0;
        const rainfallJakarta = rainfallData.rainfall_jakarta ?? waterLevelData.current?.rainfall_jakarta_mm ?? 0;

        payload = {
          water_level_cm: waterLevel,
          rainfall_mm: rainfallJakarta,
          rainfall_jakarta: rainfallJakarta,
          rainfall_bogor: rainfallBogor,
        };

        console.log('[Auto Predict] Using live data:', payload);
      } catch (autoErr: any) {
        console.error('[Auto Predict] Failed to fetch live data, using fallback:', autoErr.message);
        // Falls through to use whatever was in the original requestBody
      }
    }

    // Forward to ML service
    const mlApiResponse = await fetch(`${ML_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!mlApiResponse.ok) {
      const errorData = await mlApiResponse.json();
      console.error('Error from ML service:', errorData);
      return NextResponse.json(
        { message: errorData.detail || 'Gagal mendapatkan prediksi dari servis ML', details: errorData },
        { status: mlApiResponse.status }
      );
    }

    const predictionData = await mlApiResponse.json();

    // Tag the response with the mode used
    return NextResponse.json({
      ...predictionData,
      mode_used: mode,
      input_data: mode === 'auto' ? payload : undefined,
    });
  } catch (error: any) {
    console.error('Internal server error:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan internal pada server Next.js', details: error.message },
      { status: 500 }
    );
  }
}
