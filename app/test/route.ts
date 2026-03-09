import { NextResponse } from 'next/server';

export async function GET() {
  console.log('DEBUG: Test API route hit! (noah.ai Project)'); // Tambahkan identifikasi
  return NextResponse.json({
    message: 'Hello from Test API! (noah.ai Project)',
  });
}
