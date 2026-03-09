'use client';

import React, { useEffect, useState } from 'react';
import { Circle, Popup, useMap } from 'react-leaflet';

interface PredictionOverlay {
    position: [number, number];
    risk_level: string;
    prediction_cm: number;
    label: string;
}

const RISK_CONFIG: Record<string, { color: string; fillColor: string; radius: number; label: string }> = {
    CRITICAL: { color: '#dc2626', fillColor: '#dc2626', radius: 3000, label: 'CRITICAL' },
    BAHAYA: { color: '#ea580c', fillColor: '#ea580c', radius: 2500, label: 'BAHAYA' },
    WASPADA: { color: '#d97706', fillColor: '#d97706', radius: 2000, label: 'WASPADA' },
    AMAN: { color: '#059669', fillColor: '#059669', radius: 1500, label: 'AMAN' },
    UNKNOWN: { color: '#64748b', fillColor: '#64748b', radius: 1500, label: 'UNKNOWN' },
};

// Key monitoring points in Jakarta flood system
const MONITORING_POINTS: { id: string; name: string; position: [number, number] }[] = [
    { id: 'manggarai', name: 'Pintu Air Manggarai', position: [-6.2088, 106.8456] },
    { id: 'istiqlal', name: 'Istiqlal', position: [-6.1703, 106.8317] },
    { id: 'karet', name: 'Pintu Air Karet', position: [-6.2048, 106.8148] },
    { id: 'marina', name: 'Marina Ancol', position: [-6.1256, 106.8417] },
];

interface PredictionLayerProps {
    visible: boolean;
}

export default function PredictionLayer({ visible }: PredictionLayerProps) {
    const [prediction, setPrediction] = useState<{
        prediction_cm: number;
        risk_level: string;
        alert_message: string;
    } | null>(null);
    const map = useMap();

    useEffect(() => {
        if (!visible) return;

        const fetchPrediction = async () => {
            try {
                const res = await fetch('/api/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'auto' }),
                });
                const data = await res.json();
                if (res.ok) {
                    setPrediction(data);
                }
            } catch (e) {
                console.error('PredictionLayer fetch error:', e);
            }
        };

        fetchPrediction();
        // Refresh every 5 minutes
        const interval = setInterval(fetchPrediction, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [visible]);

    if (!visible || !prediction) return null;

    const riskLevel = prediction.risk_level || 'UNKNOWN';
    const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.UNKNOWN;

    return (
        <>
            {MONITORING_POINTS.map((point) => {
                // Primary monitoring point (Manggarai) gets the actual prediction
                // Others get a slightly lower risk for visual spread
                const isPrimary = point.id === 'manggarai';
                const pointConfig = isPrimary ? config : {
                    ...config,
                    radius: config.radius * 0.7,
                };

                return (
                    <Circle
                        key={point.id}
                        center={point.position}
                        // @ts-ignore — react-leaflet types misalign; radius works at runtime
                        radius={pointConfig.radius}
                        pathOptions={{
                            color: pointConfig.color,
                            fillColor: pointConfig.fillColor,
                            fillOpacity: isPrimary ? 0.25 : 0.15,
                            weight: isPrimary ? 2 : 1,
                            dashArray: isPrimary ? undefined : '5,5',
                        }}
                    >
                        <Popup>
                            <div className="text-sm space-y-1">
                                <p className="font-bold">{point.name}</p>
                                {isPrimary && (
                                    <>
                                        <p>Predicted: <strong>{prediction.prediction_cm} cm</strong></p>
                                        <p>Risk: <strong style={{ color: pointConfig.color }}>{riskLevel}</strong></p>
                                        <p className="text-xs text-gray-500">{prediction.alert_message}</p>
                                    </>
                                )}
                                {!isPrimary && (
                                    <p className="text-xs text-gray-500">Affected zone (based on Manggarai prediction)</p>
                                )}
                            </div>
                        </Popup>
                    </Circle>
                );
            })}
        </>
    );
}
