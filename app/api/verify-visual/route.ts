import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { status: 'error', message: 'No image file provided' },
        { status: 400 }
      );
    }

    const mlFormData = new FormData();
    mlFormData.append('file', file);

    const mlApiResponse = await fetch(`${ML_API_URL}/verify-visual`, {
      method: 'POST',
      body: mlFormData,
    });

    const data = await mlApiResponse.json();

    if (!mlApiResponse.ok) {
      return NextResponse.json(
        { status: 'error', message: data.detail || data.message || 'Visual verification failed' },
        { status: mlApiResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Verify visual error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
