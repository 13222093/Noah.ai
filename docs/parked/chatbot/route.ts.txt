// app/api/chatbot/route.ts

import { NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  Tool,
  FunctionDeclaration,
  SchemaType,
  Content,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import {
  WaterLevelPost,
  PumpData,
  BmkgGempaData,
  PetabencanaReport,
  WeatherData,
  NominatimResult,
  FetchPetabencanaReportsArgs,
  FetchWeatherDataArgs,
  GeocodeLocationArgs,
  DisplayNotificationArgs,
} from '@/lib/api';
import {
  fetchWaterLevelData,
  fetchPumpStatusData,
  fetchBmkgLatestQuake,
  fetchPetabencanaReports,
  fetchWeatherData,
  geocodeLocation,
} from '@/lib/api.client';
import { checkRateLimit, getClientIP } from '@/lib/simple-rate-limit';

// Inisialisasi Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// API Key untuk OpenWeatherMap
const OPEN_WEATHER_API_KEY =
  process.env.OPEN_WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || '';

// ===============================================
// DEFINISI FUNGSI/TOOLS
// ===============================================

const tools: Tool[] = [
  {
    functionDeclarations: [
      { name: 'fetchWaterLevelData', description: 'Mendapatkan data tinggi muka air dari pos-pos hidrologi.', parameters: { type: SchemaType.OBJECT, properties: {}, required: [] } },
      { name: 'fetchPumpStatusData', description: 'Mendapatkan status operasional pompa-pompa banjir.', parameters: { type: SchemaType.OBJECT, properties: {}, required: [] } },
      { name: 'fetchBmkgLatestQuake', description: 'Mendapatkan informasi gempa bumi terkini dari BMKG.', parameters: { type: SchemaType.OBJECT, properties: {}, required: [] } },
      { name: 'requestUserLocation', description: 'Gunakan jika pengguna menanyakan informasi berbasis lokasi tanpa menyebutkan lokasi spesifik (misal: "di sekitar saya").', parameters: { type: SchemaType.OBJECT, properties: {}, required: [] } },
      { name: 'fetchPetabencanaReports', description: 'Mendapatkan laporan bencana dari PetaBencana.id.', parameters: { type: SchemaType.OBJECT, properties: { hazardType: { type: SchemaType.STRING, description: "Jenis bencana (flood, earthquake, dll)" }, timeframe: { type: SchemaType.STRING, description: "Rentang waktu (6h, 24h, 3d, dll)" } }, required: [] } },
      { name: 'geocodeLocation', description: 'Mengubah nama lokasi menjadi koordinat.', parameters: { type: SchemaType.OBJECT, properties: { query: { type: SchemaType.STRING, description: "Nama lokasi" } }, required: ['query'] } },
      { name: 'fetchWeatherData', description: "Mendapatkan kondisi cuaca saat ini.", parameters: { type: SchemaType.OBJECT, properties: { lat: { type: SchemaType.NUMBER }, lon: { type: SchemaType.NUMBER }, locationName: { type: SchemaType.STRING } }, required: [] } },
      { name: 'displayNotification', description: 'Menampilkan notifikasi popup kepada pengguna.', parameters: { type: SchemaType.OBJECT, properties: { message: { type: SchemaType.STRING }, type: { type: SchemaType.STRING, format: 'enum', enum: ['success', 'error', 'warning', 'info', 'default'] }, duration: { type: SchemaType.NUMBER } }, required: ['message'] } },
    ],
  },
];

// ===============================================
// FUNGSI UTAMA
// ===============================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function retry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      if ([429, 503].includes(status) && i < retries - 1) {
        console.warn(`[Chatbot API] Retrying due to status ${status}. Attempt ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (i + 1)));
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries reached");
}

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!genAI) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
  }

  // Rate limit check
  const ip = getClientIP(request.headers);
  const rl = checkRateLimit(`chatbot:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const { question, history, location } = await request.json();

    const isFunctionResponseTurn = history && history.length > 0 && history[history.length - 1].role === 'function';
    if (!question && !isFunctionResponseTurn) {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: tools,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      systemInstruction:
        "Anda adalah asisten noah.ai. Tugas Anda adalah menjawab pertanyaan terkait banjir dan cuaca menggunakan tools yang tersedia. Aturan: 1. Jika nama lokasi disebutkan (misal: 'cuaca di Jakarta'), Anda WAJIB menggunakan tool `geocodeLocation` lalu `fetchWeatherData`. JANGAN PERNAH membalas dengan teks konfirmasi seperti 'Baik, saya akan cek'. Langsung panggil tool-nya. 2. Jika lokasi tidak spesifik ('di sekitar saya'), Anda WAJIB memanggil `requestUserLocation`. 3. Selalu gunakan tools jika memungkinkan.",
    });

    const contents: Content[] = [...(history || [])];
    if (location) {
        contents.unshift({
            role: 'user',
            parts: [{ text: `Konteks lokasi saat ini: ${JSON.stringify(location)}` }]
        });
    }
    if (question) {
      contents.push({ role: 'user', parts: [{ text: question }] });
    }

    const result = await retry(() => model.generateContent({ contents }));
    const response = result.response;

    // Tambahkan pengecekan ini untuk keamanan
    if (response.promptFeedback?.blockReason) {
      return NextResponse.json(
        {
          answer: `Maaf, permintaan Anda diblokir karena: ${response.promptFeedback.blockReason}. Coba ubah pertanyaan Anda.`,
        },
        { status: 200 }
      );
    }

    // ---- Multi-turn function call loop ----
    // Gemini may chain function calls (e.g. geocodeLocation → fetchWeatherData).
    // We loop up to MAX_TOOL_TURNS until Gemini returns text instead of a function call.
    const MAX_TOOL_TURNS = 5;
    let currentContents: Content[] = [...contents];
    let currentResponse = response;

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const calls = currentResponse.functionCalls();
      const call = calls ? calls[0] : undefined;

      if (!call) {
        // No more function calls — return the text
        const text = currentResponse.text();
        return NextResponse.json({ answer: text || 'Maaf, saya tidak bisa memproses permintaan ini saat ini.' }, { status: 200 });
      }

      console.log(`[Chatbot API] 🛠️ Turn ${turn + 1}: Function '${call.name}' with args:`, call.args);

      // Special actions that return to the client
      if (call.name === 'requestUserLocation') {
        return NextResponse.json({ action: 'REQUEST_LOCATION', originalCall: call }, { status: 200 });
      }
      if (call.name === 'displayNotification') {
        const args = call.args as DisplayNotificationArgs;
        return NextResponse.json({ notification: { message: args.message, type: args.type, duration: args.duration } }, { status: 200 });
      }

      // Execute the tool
      let toolResponseData: any;
      try {
        if (call.name === 'fetchWaterLevelData') toolResponseData = await fetchWaterLevelData();
        else if (call.name === 'fetchPumpStatusData') toolResponseData = await fetchPumpStatusData();
        else if (call.name === 'fetchBmkgLatestQuake') toolResponseData = await fetchBmkgLatestQuake();
        else if (call.name === 'fetchPetabencanaReports') {
          const args = call.args as FetchPetabencanaReportsArgs;
          toolResponseData = await fetchPetabencanaReports(args.hazardType, args.timeframe);
        } else if (call.name === 'geocodeLocation') {
          const args = call.args as GeocodeLocationArgs;
          const geocodeResults = await geocodeLocation(args.query);
          toolResponseData = geocodeResults?.[0] ?? { error: `Tidak dapat menemukan koordinat untuk '${args.query}'.` };
        } else if (call.name === 'fetchWeatherData') {
          const args = call.args as FetchWeatherDataArgs;
          let lat = args.lat, lon = args.lon;
          if (!lat || !lon) {
            const locationName = args.locationName || 'Jakarta';
            const geocodeResults = await geocodeLocation(locationName);
            if (geocodeResults && geocodeResults.length > 0) {
              lat = parseFloat(geocodeResults[0].lat);
              lon = parseFloat(geocodeResults[0].lon);
            } else {
              lat = -6.2088; lon = 106.8456; // Fallback Jakarta
            }
          }
          toolResponseData = await fetchWeatherData(lat, lon, OPEN_WEATHER_API_KEY);
          if (args.locationName) toolResponseData.locationName = args.locationName;
        } else {
          toolResponseData = { error: `Fungsi tidak dikenal: ${call.name}` };
        }
      } catch (toolErr: any) {
        console.error(`[Chatbot API] ❌ Error executing tool '${call.name}':`, toolErr);
        toolResponseData = { error: toolErr.message };
      }

      // Append the function call + response to conversation
      currentContents = [
        ...currentContents,
        { role: 'model', parts: [{ functionCall: call }] },
        { role: 'function', parts: [{ functionResponse: { name: call.name, response: toolResponseData } }] },
      ];

      // Ask Gemini again with the tool results
      const nextResult = await retry(() => model.generateContent({ contents: currentContents }));
      currentResponse = nextResult.response;
    }

    // Exhausted turns — return whatever text we have
    const finalText = currentResponse.text();
    return NextResponse.json({
      answer: finalText || 'Data berhasil diambil. Silakan coba pertanyaan yang lebih spesifik.',
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Chatbot API] Fatal Error in POST handler:', error);
    const errorMessage = 'Terjadi kesalahan internal server yang tidak terduga. Mohon coba lagi nanti.';
    
    // Add detailed error message in development
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ 
        error: errorMessage, 
        message: errorMessage, 
        details: error.message, // Include the actual error message
        stack: error.stack      // Include the stack trace
      }, { status: 500 });
    }

    return NextResponse.json({ error: errorMessage, message: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Chatbot API (Flash) is running OK' }, { status: 200 });
}