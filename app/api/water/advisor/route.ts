import { NextRequest, NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { chatCompletion } from "@/lib/llm";
import { WATER_RANGES, POOL_VOLUME_GAL } from "@/lib/water";
import { calculateLSI, interpretLSI, getDosingRecommendations } from "@/lib/water-chemistry";

export async function POST(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { reading, weather, message, history } = body;

  // Build context
  let readingContext = "No current readings available.";
  let lsiContext = "";
  let dosingContext = "";

  if (reading) {
    const parts: string[] = [];
    for (const [key, range] of Object.entries(WATER_RANGES)) {
      const val = reading[key];
      if (val != null) {
        parts.push(`${range.label}: ${val} ${range.unit} (ideal: ${range.min}-${range.max})`);
      }
    }
    readingContext = parts.join("\n");

    if (reading.ph != null && reading.temperature != null && reading.calciumHardness != null && reading.alkalinity != null) {
      const lsi = calculateLSI({
        ph: reading.ph,
        temperature: reading.temperature,
        calciumHardness: reading.calciumHardness,
        alkalinity: reading.alkalinity,
        tds: reading.tds ?? 1000,
      });
      const interp = interpretLSI(lsi);
      lsiContext = `\nLSI: ${lsi} — ${interp.label}`;
    }

    const recs = getDosingRecommendations(reading, POOL_VOLUME_GAL);
    if (recs.length > 0) {
      dosingContext = "\n\nCalculated dosing recommendations:\n" +
        recs.map((r) => `- [${r.priority}] ${r.param}: ${r.instruction}`).join("\n");
    }
  }

  let weatherContext = "";
  if (weather?.current) {
    weatherContext = `\nCurrent weather: ${weather.current.temperature}°F, UV ${weather.current.uvIndex}, ` +
      `humidity ${weather.current.humidity}%, wind ${weather.current.windSpeed} mph, precip ${weather.current.precipitation}mm`;
  }

  const systemPrompt = `You are a pool water chemistry expert for a ${POOL_VOLUME_GAL.toLocaleString()}-gallon saltwater pool in Independence, MO.
The pool uses a Pentair salt chlorine generator and WaterGuru SENSE puck for monitoring.

Current readings:
${readingContext}${lsiContext}${dosingContext}${weatherContext}

Ideal ranges for saltwater pool:
- pH: 7.2-7.6 (ideal 7.4)
- Free Chlorine: 2-5 ppm (ideal = 7.5% of CYA level)
- Total Alkalinity: 80-120 ppm (ideal 100)
- CYA (Stabilizer): 30-80 ppm (ideal 50)
- Salt: 2700-3400 ppm (ideal 3200)
- Calcium Hardness: 200-400 ppm (ideal 300)
- Temperature: 65-90°F
- LSI: -0.3 to +0.3 (balanced)

Important chemistry notes:
- This is a saltwater pool — the SCG generates chlorine from salt.
- FC/CYA relationship: FC should be ~7.5% of CYA for saltwater.
- Order of chemical additions: 30 min between each chemical.
- Muriatic acid lowers pH AND alkalinity.
- Never mix chemicals. Add chemicals one at a time.

Provide specific dosing amounts based on the ${POOL_VOLUME_GAL.toLocaleString()}-gallon pool volume. Be direct and actionable. Use exact measurements (fl oz, lbs, cups).`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (history && Array.isArray(history)) {
    for (const h of history) {
      if (h.role === "user" || h.role === "assistant") {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }

  messages.push({
    role: "user",
    content: message || "Analyze my current pool water readings. What should I do? Prioritize the most important actions first.",
  });

  try {
    const result = await chatCompletion(messages, {
      maxTokens: 800,
      temperature: 0.5,
      route: "water-advisor",
      type: "pool-chemistry",
    });

    return NextResponse.json({
      response: result.text,
      model: result.model,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Advisor unavailable", detail: String(err) },
      { status: 502 },
    );
  }
}
