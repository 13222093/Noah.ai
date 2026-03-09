import { NextResponse } from 'next/server';

/**
 * Smart Alert Endpoint
 * Cross-validates LSTM prediction + YOLO detection to generate
 * high-confidence flood alerts.
 *
 * Logic:
 * - Fetches latest LSTM prediction (auto mode)
 * - If prediction is BAHAYA/CRITICAL, optionally runs CCTV scan
 * - Combines both signals into a confidence-scored alert
 */

interface AlertResult {
    alert_level: string;
    confidence: number;
    sources: string[];
    prediction: any;
    detection: any | null;
    recommendation: string;
    timestamp: string;
}

export async function POST(request: Request) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    try {
        const body = await request.json().catch(() => ({}));
        const cctvUrl = body.cctv_source_url || null;

        // Step 1: Get LSTM prediction
        let prediction = null;
        try {
            const predRes = await fetch(`${baseUrl}/api/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'auto' }),
            });
            prediction = await predRes.json();
        } catch (e) {
            console.error('Smart alert: prediction fetch failed:', e);
        }

        // Step 2: Optionally run CCTV detection (if URL provided AND risk is elevated)
        let detection = null;
        const riskLevel = prediction?.risk_level || 'UNKNOWN';
        const isElevatedRisk = ['BAHAYA', 'CRITICAL', 'WASPADA'].includes(riskLevel);

        if (cctvUrl && isElevatedRisk) {
            try {
                const cctvRes = await fetch(`${baseUrl}/api/cctv-scan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source_url: cctvUrl }),
                });
                detection = await cctvRes.json();
            } catch (e) {
                console.error('Smart alert: CCTV scan failed:', e);
            }
        }

        // Step 3: Cross-validate and score confidence
        const sources: string[] = [];
        let confidence = 0;
        let alertLevel = 'AMAN';

        // LSTM contribution
        if (prediction && prediction.risk_level) {
            sources.push('PREDICTION');
            switch (prediction.risk_level) {
                case 'CRITICAL': confidence += 0.5; break;
                case 'BAHAYA': confidence += 0.4; break;
                case 'WASPADA': confidence += 0.25; break;
                case 'AMAN': confidence += 0.05; break;
            }
        }

        // YOLO contribution
        if (detection && detection.is_flooded !== undefined) {
            sources.push('VISUAL');
            if (detection.is_flooded) {
                confidence += 0.4 * (detection.flood_probability || 0.5);
            }
        }

        // Determine final alert level
        if (confidence >= 0.7) {
            alertLevel = 'CRITICAL';
        } else if (confidence >= 0.5) {
            alertLevel = 'BAHAYA';
        } else if (confidence >= 0.3) {
            alertLevel = 'WASPADA';
        } else {
            alertLevel = 'AMAN';
        }

        // Generate recommendation
        const recommendations: Record<string, string> = {
            CRITICAL: '🚨 EVAKUASI SEGERA! Prediksi AI dan deteksi visual mengkonfirmasi banjir kritis. Segera menuju posko evakuasi terdekat.',
            BAHAYA: '⚠️ WASPADA TINGGI! Risiko banjir tinggi terdeteksi. Siapkan barang penting dan pantau informasi terbaru.',
            WASPADA: 'ℹ️ SIAGA! Potensi banjir terdeteksi. Pantau ketinggian air dan siapkan rencana evakuasi.',
            AMAN: '✅ Kondisi aman. Tetap pantau perkembangan cuaca.',
        };

        const result: AlertResult = {
            alert_level: alertLevel,
            confidence: Math.round(confidence * 100) / 100,
            sources,
            prediction: prediction ? {
                prediction_cm: prediction.prediction_cm,
                risk_level: prediction.risk_level,
            } : null,
            detection: detection ? {
                is_flooded: detection.is_flooded,
                flood_probability: detection.flood_probability,
            } : null,
            recommendation: recommendations[alertLevel] || recommendations.AMAN,
            timestamp: new Date().toISOString(),
        };

        // Step 5: Trigger SMS alerts for elevated risk (fire-and-forget)
        if (['WASPADA', 'BAHAYA', 'CRITICAL'].includes(alertLevel)) {
            const smsPayload = {
                alert_level: alertLevel,
                region_id: body.region_id || 'MANGGARAI_01',
                water_level_cm: prediction?.prediction_cm,
                recommendation: recommendations[alertLevel],
            };

            fetch(`${baseUrl}/api/sms-alert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(smsPayload),
            }).then(async (res) => {
                const smsResult = await res.json();
                console.log(`[Smart Alert → SMS] ${smsResult.sms_sent || 0} SMS sent for ${alertLevel} alert`);
            }).catch((smsErr) => {
                console.warn('[Smart Alert → SMS] SMS trigger failed (non-blocking):', smsErr.message);
            });

            result.sources.push('SMS');
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Smart alert error:', error);
        return NextResponse.json(
            { error: 'Smart alert generation failed', details: error.message },
            { status: 500 }
        );
    }
}
