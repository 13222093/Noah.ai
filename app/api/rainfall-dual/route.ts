import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Dual-location rainfall endpoint.
 * Fetches current rainfall from OpenWeatherMap for both Bogor and Jakarta.
 * This is required because the LSTM model needs separate rainfall readings
 * for both cities (hujan_bogor and hujan_jakarta).
 */

// Fixed coordinates for the two monitoring locations
const LOCATIONS = {
    bogor: { lat: -6.5971, lon: 106.806, name: 'Bogor' },
    jakarta: { lat: -6.2088, lon: 106.8456, name: 'Jakarta' },
};

export async function GET() {
    const API_KEY = process.env.OPENWEATHER_API_KEY;

    if (!API_KEY) {
        return NextResponse.json(
            { error: 'OpenWeatherMap API key not configured' },
            { status: 500 }
        );
    }

    try {
        const [bogorRes, jakartaRes] = await Promise.all([
            axios.get('https://api.openweathermap.org/data/2.5/weather', {
                params: {
                    lat: LOCATIONS.bogor.lat,
                    lon: LOCATIONS.bogor.lon,
                    appid: API_KEY,
                    units: 'metric',
                },
            }),
            axios.get('https://api.openweathermap.org/data/2.5/weather', {
                params: {
                    lat: LOCATIONS.jakarta.lat,
                    lon: LOCATIONS.jakarta.lon,
                    appid: API_KEY,
                    units: 'metric',
                },
            }),
        ]);

        // Extract rainfall (rain.1h may not exist if it's not raining)
        const rainfallBogor = bogorRes.data.rain?.['1h'] ?? 0;
        const rainfallJakarta = jakartaRes.data.rain?.['1h'] ?? 0;

        return NextResponse.json({
            rainfall_bogor: rainfallBogor,
            rainfall_jakarta: rainfallJakarta,
            weather_bogor: {
                temp: bogorRes.data.main?.temp,
                humidity: bogorRes.data.main?.humidity,
                description: bogorRes.data.weather?.[0]?.description,
            },
            weather_jakarta: {
                temp: jakartaRes.data.main?.temp,
                humidity: jakartaRes.data.main?.humidity,
                description: jakartaRes.data.weather?.[0]?.description,
            },
            timestamp: new Date().toISOString(),
            note: 'rain.1h returns 0 when not raining (field absent in API response)',
        });
    } catch (error: any) {
        console.error('Dual rainfall fetch error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch rainfall data', details: error.message },
            { status: 500 }
        );
    }
}
