import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Sensor simulator using real historical data replay.
 * Replaces the old Math.random() simulator with actual 2020 TMA Manggarai data
 * for realistic flood monitoring demo.
 */

interface HistoricalRow {
  timestamp: string;
  hujan_bogor: number;
  hujan_jakarta: number;
  tma_manggarai: number;
}

let cachedData: HistoricalRow[] | null = null;

function loadHistoricalData(): HistoricalRow[] {
  if (cachedData) return cachedData;

  const csvPath = path.join(process.cwd(), 'ml-service', 'data', 'DATASET_FINAL_TRAINING.csv');

  try {
    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.trim().split('\n');
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(',');
      return {
        timestamp: parts[0].trim(),
        hujan_bogor: parseFloat(parts[1]) || 0,
        hujan_jakarta: parseFloat(parts[2]) || 0,
        tma_manggarai: parseFloat(parts[3]) || 0,
      };
    });
    cachedData = rows;
    return rows;
  } catch (e) {
    console.error('Failed to load historical data for sensor sim:', e);
    return [];
  }
}

export async function GET() {
  const data = loadHistoricalData();

  if (data.length === 0) {
    // Fallback to the old random approach if CSV is missing
    const now = new Date();
    const hour = now.getHours();
    const baseWaterLevel = 300 + Math.sin((hour / 24) * Math.PI * 2) * 100;
    const rainfall = Math.random() * 30;

    return NextResponse.json({
      timestamp: now.toISOString(),
      water_level_cm: Math.round(baseWaterLevel + Math.random() * 30),
      rainfall_mm: Math.round(rainfall * 10) / 10,
      location_id: 'MANGGARAI_01',
      risk_level:
        baseWaterLevel >= 850 ? 'CRITICAL' :
          baseWaterLevel >= 700 ? 'BAHAYA' :
            baseWaterLevel >= 400 ? 'WASPADA' : 'AMAN',
      source: 'random_fallback',
    });
  }

  // Replay based on current time
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfMonth = now.getDate() - 1;
  const index = (dayOfMonth * 24 + hour) % data.length;

  const current = data[index];

  // Add slight variation per minute to make it feel "live"
  const minuteJitter = (minute / 60) * (
    index + 1 < data.length
      ? data[index + 1].tma_manggarai - current.tma_manggarai
      : 0
  );

  const waterLevel = Math.round((current.tma_manggarai + minuteJitter) * 100) / 100;
  const rainfall = current.hujan_jakarta; // Use Jakarta rainfall as primary

  const riskLevel =
    waterLevel >= 850 ? 'CRITICAL' :
      waterLevel >= 700 ? 'BAHAYA' :
        waterLevel >= 400 ? 'WASPADA' : 'AMAN';

  return NextResponse.json({
    timestamp: now.toISOString(),
    water_level_cm: waterLevel,
    rainfall_mm: rainfall,
    rainfall_bogor_mm: current.hujan_bogor,
    rainfall_jakarta_mm: current.hujan_jakarta,
    location_id: 'MANGGARAI_01',
    risk_level: riskLevel,
    source: 'historical_replay',
    original_timestamp: current.timestamp,
  });
}
