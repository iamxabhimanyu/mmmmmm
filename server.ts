import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// Port configuration:
// In the AI Studio dev environment, DEFAULT_APP_PORT is set to 3000 behind Nginx (which listens on 8080).
// In deployed Cloud Run production, Cloud Run assigns PORT (usually 8080) and expects direct listening.
// Fallback defaults to 3000 for local development.
const PORT = process.env.DEFAULT_APP_PORT
  ? parseInt(process.env.DEFAULT_APP_PORT, 10)
  : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

app.use(express.json());

// Ingress health check endpoints for Cloud Run & monitoring probes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", port: PORT });
});
app.get("/health", (_req, res) => {
  res.json({ status: "ok", port: PORT });
});

// API: Server-side Gemini AI for Mausam Weather Intelligence
app.post("/api/weather-ai", async (req, res) => {
  try {
    const rawWeather = req.body.weatherContext || req.body.weatherData || req.body.weather;
    const { prompt, location, language = "English", persona = "General Citizen" } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Graceful meteorological rule-based intelligence fallback if API key is not yet set
      const fallbackResponse = generateLocalWeatherInsight(prompt, rawWeather, location, language, persona);
      return res.json({ text: fallbackResponse, source: "meteorological-engine" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are MAUSAM AI, India's premier meteorological intelligence assistant for the India Meteorological Department (IMD) inspired MAUSAM ecosystem.
Current Context:
Location: ${location || "India"}
Persona: ${persona}
Language: ${language}
Current Weather Context: ${JSON.stringify(rawWeather || {})}

Guidelines:
- CRITICAL DATA INTEGRITY & ARCHITECTURAL BOUNDARIES:
  * UNKNOWN ≠ SAFE: Missing or unobserved data is not an indicator of safe or clear weather.
  * Never invent weather measurements. Never fabricate values for temperature, AQI, rain, wind, or visibility.
  * DETERMINISTIC NUMERIC INTELLIGENCE: Respect all deterministic hazard classifications, alerts, and persona scores provided in the context; do not override or contradict them.
- If a meteorological variable or observation is marked 'Unavailable', missing, or null, explicitly state that live data for that parameter is not available rather than assuming a default or safe value.
- NEVER claim that unprovided official alerts, bulletins, or warnings exist.
- Provide clear, actionable, and culturally relevant advice for India (mentioning monsoons, heatwaves, cyclones, western disturbances, crop safety, daily commute, or coastal conditions when relevant).
- Always format temperatures in Celsius (°C).
- Use a friendly, professional tone matching Google Weather simplicity: concise, high readability, bullet points when listing actions.
- If asked in Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, or Punjabi, respond in that language or bilingual format.
- Avoid robotic disclaimers; deliver direct, actionable meteorological guidance.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const text = response.text || "No response received from MAUSAM AI.";
    return res.json({ text, source: "gemini-3.8-flash" });
  } catch (error: any) {
    console.error("Gemini API error:", error?.message || error);
    // Intelligent fallback on network or key issue
    const rawWeather = req.body?.weatherContext || req.body?.weatherData || req.body?.weather;
    const { prompt, location, language = "English", persona = "General Citizen" } = req.body || {};
    const fallbackResponse = generateLocalWeatherInsight(prompt || "", rawWeather, location, language, persona);
    return res.json({
      text: fallbackResponse,
      source: "meteorological-engine-fallback",
      note: "Live weather reasoning applied based on verified meteorological parameters.",
    });
  }
});

// Proxy for Open-Meteo Geocoding API (Fast, accurate worldwide & India coverage)
app.get("/api/geocode", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length < 2) {
      return res.json({ results: [] });
    }

    const encoded = encodeURIComponent(q.trim());
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=15&language=en&format=json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MausamWeatherApp/2.0 (weather.india@mausam.gov.in)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: "Open-Meteo geocoding rate limited (HTTP 429)", results: [] });
      }
      return res.status(response.status).json({ error: `Geocoding upstream returned HTTP ${response.status}`, results: [] });
    }

    const data = await response.json();
    if (data && Array.isArray(data.results)) {
      data.results = data.results.filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        const lat = Number(item.latitude);
        const lon = Number(item.longitude);
        return (
          Number.isFinite(lat) &&
          Number.isFinite(lon) &&
          !Number.isNaN(lat) &&
          !Number.isNaN(lon) &&
          lat >= -90 &&
          lat <= 90 &&
          lon >= -180 &&
          lon <= 180
        );
      });
    }
    return res.json(data);
  } catch (err: any) {
    console.error("Open-Meteo geocoding error:", err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: "Geocoding request timed out after 8 seconds", results: [] });
    }
    return res.status(500).json({ error: "Geocoding service unavailable", results: [] });
  }
});

// Proxy for Nominatim geocoding & reverse geocoding with Indian constraints
app.get("/api/search-location", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Check if query is coordinates for reverse geocoding: "lat,lon"
    const coordMatch = q.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const latNum = parseFloat(coordMatch[1]);
      const lonNum = parseFloat(coordMatch[3]);
      if (
        isNaN(latNum) ||
        isNaN(lonNum) ||
        !isFinite(latNum) ||
        !isFinite(lonNum) ||
        latNum < -90 ||
        latNum > 90 ||
        lonNum < -180 ||
        lonNum > 180
      ) {
        return res.status(400).json({ error: "Invalid coordinates provided for reverse geocoding" });
      }

      const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=14&addressdetails=1`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(revUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "MausamWeatherApp/2.0 (weather.india@mausam.gov.in)",
          "Accept-Language": "en,hi",
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          return res.status(429).json({ error: "Nominatim rate limited (HTTP 429)" });
        }
        return res.status(response.status).json({ error: `Nominatim reverse geocoding returned HTTP ${response.status}` });
      }

      const item = await response.json();
      if (!item || typeof item !== 'object' || !item.lat || !item.lon) {
        return res.json([]);
      }
      const itemLat = parseFloat(item.lat);
      const itemLon = parseFloat(item.lon);
      if (isNaN(itemLat) || isNaN(itemLon) || itemLat < -90 || itemLat > 90 || itemLon < -180 || itemLon > 180) {
        return res.json([]);
      }
      return res.json([item]);
    }

    const encoded = encodeURIComponent(q);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&addressdetails=1&limit=10`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MausamWeatherApp/2.0 (weather.india@mausam.gov.in)",
        "Accept-Language": "en,hi",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: "Nominatim rate limited (HTTP 429)" });
      }
      return res.status(response.status).json({ error: `Nominatim search returned HTTP ${response.status}` });
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return res.json([]);
    }
    // Filter and sanitize data: must have valid lat and lon numbers
    const validData = data.filter((item: any) => {
      if (!item || typeof item !== 'object') return false;
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      return (
        !isNaN(lat) &&
        !isNaN(lon) &&
        isFinite(lat) &&
        isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      );
    });
    return res.json(validData);
  } catch (err: any) {
    console.error("Geocoding error:", err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: "Nominatim request timed out after 8 seconds" });
    }
    return res.status(500).json({ error: "Location search service unavailable: " + err.message });
  }
});

// Weather rule-based intelligence engine (truthful fallback, no synthetic metrics)
export function generateLocalWeatherInsight(
  prompt: string,
  weather: any,
  location: string = "India",
  language: string = "English",
  persona: string = "General Citizen"
): string {
  const p = prompt.toLowerCase();

  // Extract raw candidates from multiple possible structures (CurrentWeather, Open-Meteo current, etc.)
  const rawTemp =
    typeof weather?.temperature === 'number'
      ? weather.temperature
      : typeof weather?.current?.temperature_2m === 'number'
      ? weather.current.temperature_2m
      : typeof weather?.temp === 'number'
      ? weather.temp
      : undefined;
  const temp = typeof rawTemp === 'number' && Number.isFinite(rawTemp) ? rawTemp : undefined;

  const rawCondition =
    typeof weather?.conditionText === 'string'
      ? weather.conditionText
      : typeof weather?.current?.conditionText === 'string'
      ? weather.current.conditionText
      : typeof weather?.condition === 'string'
      ? weather.condition
      : undefined;
  const condition = rawCondition && rawCondition.trim().length > 0 ? rawCondition.trim() : undefined;

  const rawRainProb =
    typeof weather?.precipitationProb === 'number'
      ? weather.precipitationProb
      : typeof weather?.hourlyRainProbMax === 'number'
      ? weather.hourlyRainProbMax
      : typeof weather?.rainProb === 'number'
      ? weather.rainProb
      : undefined;
  const rainProb = typeof rawRainProb === 'number' && Number.isFinite(rawRainProb) ? rawRainProb : undefined;

  const rawAqi =
    typeof weather?.aqi === 'number'
      ? weather.aqi
      : typeof weather?.airQuality?.aqi === 'number'
      ? weather.airQuality.aqi
      : undefined;
  const aqi = typeof rawAqi === 'number' && Number.isFinite(rawAqi) ? rawAqi : undefined;

  const rawWind =
    typeof weather?.windSpeed === 'number'
      ? weather.windSpeed
      : typeof weather?.current?.wind_speed_10m === 'number'
      ? weather.current.wind_speed_10m
      : typeof weather?.wind === 'number'
      ? weather.wind
      : undefined;
  const wind = typeof rawWind === 'number' && Number.isFinite(rawWind) ? rawWind : undefined;

  // Complete data unavailability check
  if (temp === undefined && condition === undefined && rainProb === undefined && aqi === undefined && wind === undefined) {
    return `⚠️ **Meteorological Notice for ${location}**:\nLive meteorological observations and air quality parameters are currently unavailable for this location. We cannot verify current temperature, precipitation risk, or atmospheric conditions at this moment. Please verify your connection or consult official local advisories.`;
  }

  if (p.includes("rain") || p.includes("umbrella") || p.includes("barish")) {
    if (rainProb !== undefined) {
      if (rainProb > 40) {
        return `🌧️ **Rain Forecast for ${location}**:\nThere is a **${rainProb}% chance of rain** today. Current condition is **${condition || 'rain likely'}**. We strongly recommend carrying an umbrella or light rain jacket if heading out, especially during evening commute hours.`;
      } else {
        return `☀️ **Rain Outlook for ${location}**:\nRain probability is low (**${rainProb}%**) for today under **${condition || 'fair'}** skies. An umbrella is unlikely to be needed, but stay updated with our hourly forecast for any local convective showers.`;
      }
    } else {
      return `🌧️ **Rain Forecast for ${location}**:\nDetailed precipitation probability data is currently unavailable for this location. Sky condition is reported as **${condition || 'Unobserved'}**. Please check the Doppler radar or hourly timeline before scheduling outdoor operations.`;
    }
  }

  if (p.includes("crop") || p.includes("farm") || p.includes("kisan") || p.includes("spray") || persona.toLowerCase().includes("farmer")) {
    if (rainProb === undefined || wind === undefined) {
      return `🌾 **Agro-Met Krishi Advisory for ${location}**:\n- **Spray Recommendation**: ⚠️ **Cannot verify spray safety**. Live wind or rainfall probability observations are currently unavailable. Agrochemical spraying should be deferred until local wind and precipitation can be verified.\n- **Irrigation**: Monitor soil moisture manually; automatic evapotranspiration calculations are unavailable.\n- **Harvest & Storage**: Keep harvested produce sheltered under tarpaulins if sky conditions are overcast.`;
    }

    const safeSpray = rainProb < 30 && wind < 18;
    return `🌾 **Agro-Met Krishi Advisory for ${location}**:\n- **Spray Recommendation**: ${
      safeSpray
        ? "✅ **Safe to spray**. Winds are moderate (" + wind + " km/h) and rain probability is low (" + rainProb + "%)."
        : "⚠️ **Postpone chemical spraying**. Rain chance is elevated (" + rainProb + "%) or winds may cause droplet drift (" + wind + " km/h)."
    }\n- **Irrigation**: ${
      temp !== undefined
        ? `Given the ${temp}°C temperature, light morning or late afternoon irrigation is optimal.`
        : "Irrigate based on visual soil moisture assessment."
    }\n- **Harvest & Storage**: Keep harvested produce covered if local nowcasts show sudden squalls.`;
  }

  if (p.includes("aqi") || p.includes("air") || p.includes("pollution") || p.includes("hawa")) {
    if (aqi === undefined) {
      return `🍃 **Air Quality Assessment for ${location}**:\n- **AQI Value**: **Unavailable** (Air quality monitoring station telemetry is not currently reporting for this district).\n- **Guidance**: If dust, smoke, or haze is observed locally, sensitive individuals should take standard respiratory precautions.`;
    }

    const status = aqi <= 50 ? "Good" : aqi <= 100 ? "Satisfactory" : aqi <= 200 ? "Moderate" : aqi <= 300 ? "Poor" : aqi <= 400 ? "Very Poor" : "Severe";
    return `🍃 **Air Quality Assessment for ${location}**:\n- **AQI Value**: **${aqi}** (${status} category as per Indian CPCB standards).\n- **Guidance**: ${
      aqi > 150
        ? "Sensitive individuals (children, elderly, asthma patients) should avoid prolonged heavy outdoor exertion. Use an N95 mask during peak traffic hours."
        : "Air quality is suitable for normal outdoor recreational activities and morning walks."
    }`;
  }

  if (p.includes("travel") || p.includes("road") || p.includes("flight") || persona.toLowerCase().includes("traveller")) {
    if (temp === undefined && wind === undefined && rainProb === undefined) {
      return `🚗 **Travel & Commute Weather for ${location}**:\n- **Meteorological Telemetry**: Real-time road and weather telemetry is currently unavailable.\n- **Recommendation**: Check local traffic advisories and drive with appropriate caution for current visibility.`;
    }

    const tempStr = temp !== undefined ? `${temp}°C` : "Temp unavailable";
    const rainStr = rainProb !== undefined ? `rain risk is ${rainProb}%` : "rain probability unavailable";
    const windStr = wind !== undefined ? `crosswinds (${wind} km/h)` : "winds";
    const hasVis = typeof weather?.visibility === 'number' && Number.isFinite(weather.visibility) && weather.visibility > 0;
    const visStr = hasVis ? `Road visibility is ${weather.visibility} km` : 'Road visibility is unobserved';
    const recStr = hasVis && weather.visibility < 3
      ? 'Reduce speed; fog or mist may affect highway corridors.'
      : rainProb !== undefined && rainProb > 40
      ? 'Wet pavement expected; maintain extended following distance.'
      : hasVis
      ? `Driving conditions are clear. If crossing ghat sections or river bridges, be mindful of ${windStr}.`
      : `Drive with standard caution. If crossing ghat sections or river bridges, be mindful of ${windStr}.`;

    return `🚗 **Travel & Commute Weather for ${location}**:\n- **Current Temp**: ${tempStr} (${condition || 'unobserved'})\n- **Visibility & Road Safety**: ${visStr}; ${rainStr}.\n- **Recommendation**: ${recStr}`;
  }

  const tempDisplay = temp !== undefined ? `**${temp}°C**` : '**Unavailable**';
  const condDisplay = condition || 'Condition unobserved';
  const rainDisplay = rainProb !== undefined ? `**${rainProb}% probability**` : '**Unavailable**';
  const windDisplay = wind !== undefined ? `${wind} km/h` : 'Unavailable';
  const aqiDisplay = aqi !== undefined ? `${aqi}` : 'Unavailable';

  const hasCoreData = temp !== undefined || rainProb !== undefined;
  const advice = hasCoreData
    ? `*Actionable Advice*: Atmospheric observations are reporting for ${persona.toLowerCase()} routines. Check the hourly forecast timeline for any sudden convective developments.`
    : `*Actionable Advice*: Key atmospheric parameters are currently unobserved. Exercise caution for ${persona.toLowerCase()} outdoor activities until live telemetry is restored.`;

  return `🌤️ **MAUSAM Intelligence Summary for ${location}**:\n- **Current Temperature**: ${tempDisplay} (${condDisplay})\n- **Precipitation Outlook**: ${rainDisplay}\n- **Wind**: ${windDisplay} | **AQI**: ${aqiDisplay}\n\n${advice}`;
}

async function startServer() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (!process.env.DEFAULT_APP_PORT && fs.existsSync(path.join(process.cwd(), "dist", "index.html")));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
    const distPath = fs.existsSync(path.join(process.cwd(), "dist"))
      ? path.join(process.cwd(), "dist")
      : (fs.existsSync(path.join(currentDir, "../dist")) ? path.join(currentDir, "../dist") : currentDir);

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MAUSAM Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? "production" : "development"})`);
  });
}

startServer();
