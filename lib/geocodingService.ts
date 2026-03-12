import { GeocodingResponse, ReverseGeocodingResponse } from '../types/geocoding';
import { AirPollutionData } from '../types/airPollution';

const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY || process.env.OPENWEATHER_API_KEY || '';

export async function getCurrentWeather(latitude: number, longitude: number) {
  if (!API_KEY) {
    throw new Error('OpenWeatherMap API key not configured');
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=id`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Gagal mengambil data cuaca.');
  }
  return response.json();
}

export async function getCoordsByLocationName(locationName: string, limit: number = 5): Promise<GeocodingResponse[] | null> {
  if (!API_KEY) return [];
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=${limit}&appid=${API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function getLocationNameByCoords(lat: number, lng: number): Promise<ReverseGeocodingResponse | null> {
  if (!API_KEY) return null;
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lng}&limit=1&appid=${API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data[0] || null;
  } catch {
    return null;
  }
}

export async function getAirPollutionData(latitude: number, longitude: number): Promise<AirPollutionData | null> {
  if (!API_KEY) return null;
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.list?.[0] || null;
  } catch {
    return null;
  }
}