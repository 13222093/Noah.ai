import { NextResponse } from 'next/server';

/**
 * CCTV Scan Endpoint
 * Pulls a frame from a CCTV source URL and sends it to the ML service
 * for YOLO flood detection analysis.
 */

export async function POST(request: Request) {
    const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

    try {
        const body = await request.json();
        const { source_url, source_name, location_lat, location_lon } = body;

        if (!source_url) {
            return NextResponse.json(
                { error: 'source_url is required' },
                { status: 400 }
            );
        }

        // Step 1: Fetch the image from the CCTV source
        let imageBlob: Blob;
        try {
            const imageRes = await fetch(source_url, {
                headers: { 'User-Agent': 'noah.ai/1.0 CCTV Scanner' },
            });

            if (!imageRes.ok) {
                throw new Error(`Failed to fetch CCTV frame: ${imageRes.status}`);
            }

            imageBlob = await imageRes.blob();
        } catch (fetchErr: any) {
            return NextResponse.json(
                { error: `CCTV source unreachable: ${fetchErr.message}`, source_url },
                { status: 502 }
            );
        }

        // Step 2: Send to ML service for YOLO visual verification
        const formData = new FormData();
        formData.append('file', imageBlob, 'cctv_frame.jpg');

        const mlRes = await fetch(`${ML_API_URL}/verify-visual`, {
            method: 'POST',
            body: formData,
        });

        if (!mlRes.ok) {
            const errData = await mlRes.json().catch(() => ({}));
            return NextResponse.json(
                { error: 'ML visual verification failed', details: errData },
                { status: mlRes.status }
            );
        }

        const detection = await mlRes.json();

        // Step 3: Enrich result with source metadata
        const result = {
            ...detection,
            source_name: source_name || 'Unknown CCTV',
            source_url,
            location: {
                lat: location_lat || null,
                lon: location_lon || null,
            },
            scanned_at: new Date().toISOString(),
        };

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('CCTV scan error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
