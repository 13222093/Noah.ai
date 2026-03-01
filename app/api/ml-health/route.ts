import { NextResponse } from 'next/server';

export async function GET() {
  const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

  try {
    const response = await fetch(`${ML_API_URL}/health`, {
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('ML health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'ML service unavailable',
        models: { lstm_ready: false, vision_ready: false },
      },
      { status: 503 }
    );
  }
}
