// Real weather service for IoT sensor data
// Uses wttr.in (free, no key required, works from Docker containers)
// Fallback: Open-Meteo API

interface WeatherData {
  temperature: number;  // celsius
  humidity: number;     // percentage
  latitude: number;
  longitude: number;
  timestamp: string;    // ISO
}

// Default location: Tokyo
const DEFAULT_CITY = "Tokyo";
const DEFAULT_LAT = 35.6762;
const DEFAULT_LON = 139.6503;

// Cache with 60s TTL
let cache: { data: WeatherData; ts: number } | null = null;
const CACHE_TTL = 60_000;

const FALLBACK: WeatherData = {
  temperature: 22.5,
  humidity: 65,
  latitude: DEFAULT_LAT,
  longitude: DEFAULT_LON,
  timestamp: new Date().toISOString(),
};

async function fetchFromWttr(): Promise<WeatherData | null> {
  try {
    const res = await fetch(`https://wttr.in/${DEFAULT_CITY}?format=j1`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const current = json.current_condition?.[0];
    if (!current) return null;

    return {
      temperature: parseFloat(current.temp_C),
      humidity: parseFloat(current.humidity),
      latitude: parseFloat(json.nearest_area?.[0]?.latitude || String(DEFAULT_LAT)),
      longitude: parseFloat(json.nearest_area?.[0]?.longitude || String(DEFAULT_LON)),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchFromOpenMeteo(): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&current=temperature_2m,relative_humidity_2m`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json();

    return {
      temperature: json.current.temperature_2m,
      humidity: json.current.relative_humidity_2m,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LON,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchWeather(): Promise<WeatherData> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  // Try wttr.in first (works from Docker), then Open-Meteo as fallback
  const data = (await fetchFromWttr()) ?? (await fetchFromOpenMeteo()) ?? FALLBACK;
  cache = { data, ts: Date.now() };
  return data;
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
