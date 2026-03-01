import { NextResponse } from 'next/server';

export async function GET() {
  const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

  try {
    const response = await fetch(`${ML_API_URL}/scenarios`);

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Scenarios fetch error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch scenarios',
        scenarios: [],
      },
      { status: 500 }
    );
  }
}
