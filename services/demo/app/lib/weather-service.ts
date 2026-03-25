// Open-Meteo weather service for real IoT sensor data
// Free API, no key required

interface WeatherData {
  temperature: number;  // celsius
  humidity: number;     // percentage
  latitude: number;
  longitude: number;
  timestamp: string;    // ISO
}

// Default location: Tokyo
const DEFAULT_LAT = 35.6762;
const DEFAULT_LON = 139.6503;

// Cache with 30s TTL
let cache: { data: WeatherData; ts: number } | null = null;
const CACHE_TTL = 30_000;

async function fetchWeather(): Promise<WeatherData> {
  // Check cache
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&current=temperature_2m,relative_humidity_2m`;
    const res = await fetch(url);
    const json = await res.json();

    const data: WeatherData = {
      temperature: json.current.temperature_2m,
      humidity: json.current.relative_humidity_2m,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LON,
      timestamp: new Date().toISOString(),
    };

    cache = { data, ts: Date.now() };
    return data;
  } catch {
    // Fallback
    return {
      temperature: 22.5,
      humidity: 65,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LON,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getReading(type: "temperature" | "humidity" | "gps") {
  const weather = await fetchWeather();
  const now = new Date().toISOString();

  switch (type) {
    case "temperature":
      return { type, value: weather.temperature.toFixed(1), unit: "\u00B0C", timestamp: now };
    case "humidity":
      return { type, value: weather.humidity.toFixed(0), unit: "%", timestamp: now };
    case "gps":
      return { type, value: `${weather.latitude.toFixed(4)}, ${weather.longitude.toFixed(4)}`, unit: "coords", timestamp: now };
  }
}
