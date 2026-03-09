'use client';

import { useState, useEffect, useCallback } from 'react';

interface PredictionData {
    prediction_cm: number;
    risk_level: string;
    alert_message: string;
    mode_used?: string;
    input_data?: {
        water_level_cm: number;
        rainfall_bogor: number;
        rainfall_jakarta: number;
    };
}

interface UsePredictionResult {
    prediction: PredictionData | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
    lastUpdated: Date | null;
}

export function usePredictionData(autoFetchInterval?: number): UsePredictionResult {
    const [prediction, setPrediction] = useState<PredictionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchPrediction = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'auto' }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to fetch prediction');
            }

            setPrediction(data);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Prediction failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchPrediction();

        // Set up interval if specified
        if (autoFetchInterval && autoFetchInterval > 0) {
            const interval = setInterval(fetchPrediction, autoFetchInterval);
            return () => clearInterval(interval);
        }
    }, [fetchPrediction, autoFetchInterval]);

    return { prediction, loading, error, refetch: fetchPrediction, lastUpdated };
}
