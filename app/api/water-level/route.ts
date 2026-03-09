import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Historical replay water level endpoint.
 * Uses real 2020 TMA Manggarai data from DATASET_FINAL_TRAINING.csv,
 * replayed based on current hour-of-day for realistic demo patterns.
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
    // Skip header: "Unnamed: 0,hujan_bogor,hujan_jakarta,tma_manggarai"
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
    console.error('Failed to load historical data:', e);
    return [];
  }
}

function getReplayIndex(data: HistoricalRow[]): number {
  // Map current time into the dataset using hour-of-day + day-of-month
  const now = new Date();
  const hour = now.getHours();
  const dayOfMonth = now.getDate() - 1; // 0-indexed
  const index = (dayOfMonth * 24 + hour) % data.length;
  return index;
}

export async function GET(request: NextRequest) {
  const data = loadHistoricalData();

  if (data.length === 0) {
    return NextResponse.json(
      { error: 'Historical data not available' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const windowStr = searchParams.get('window');
  const window = windowStr ? parseInt(windowStr, 10) : 1; // default: 1 reading

  const currentIndex = getReplayIndex(data);

  // Return a window of readings (for charts / history)
  const startIndex = Math.max(0, currentIndex - window + 1);
  const readings = data.slice(startIndex, currentIndex + 1).map((row, i) => ({
    timestamp: new Date().toISOString(), // Current replay timestamp
    water_level_cm: row.tma_manggarai,
    rainfall_bogor_mm: row.hujan_bogor,
    rainfall_jakarta_mm: row.hujan_jakarta,
    location_id: 'MANGGARAI_01',
    source: 'historical_replay',
    original_timestamp: row.timestamp,
  }));

  // Current reading (latest)
  const current = data[currentIndex];
  const riskLevel =
    current.tma_manggarai >= 850 ? 'CRITICAL' :
    current.tma_manggarai >= 700 ? 'BAHAYA' :
    current.tma_manggarai >= 400 ? 'WASPADA' : 'AMAN';

  return NextResponse.json({
    current: {
      timestamp: new Date().toISOString(),
      water_level_cm: current.tma_manggarai,
      rainfall_bogor_mm: current.hujan_bogor,
      rainfall_jakarta_mm: current.hujan_jakarta,
      location_id: 'MANGGARAI_01',
      risk_level: riskLevel,
      source: 'historical_replay',
      original_timestamp: current.timestamp,
    },
    history: window > 1 ? readings : undefined,
    meta: {
      dataset_size: data.length,
      replay_index: currentIndex,
      note: 'Data replayed from real 2020 TMA Manggarai historical records',
    },
  });
}
