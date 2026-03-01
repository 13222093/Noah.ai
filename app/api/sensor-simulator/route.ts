import { NextResponse } from 'next/server';

/**
 * Simulated sensor data stream for Floodnet-style monitoring.
 * Returns water level and rainfall data that can be polled for real-time charts.
 */
export async function GET() {
  // Simulate data based on Floodnet TMA Manggarai / rainfall pattern
  const now = new Date();
  const hour = now.getHours();
  const baseWaterLevel = 300 + Math.sin(hour / 24 * Math.PI * 2) * 100;
  const rainfall = Math.random() * 30;

  const data = {
    timestamp: now.toISOString(),
    water_level_cm: Math.round(baseWaterLevel + Math.random() * 30),
    rainfall_mm: Math.round(rainfall * 10) / 10,
    location_id: 'MANGGARAI_01',
    risk_level:
      baseWaterLevel >= 850 ? 'CRITICAL' :
      baseWaterLevel >= 700 ? 'BAHAYA' :
      baseWaterLevel >= 400 ? 'WASPADA' : 'AMAN',
  };

  return NextResponse.json(data);
}
