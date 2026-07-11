import Anthropic from "@anthropic-ai/sdk";
import { assertPublicUrl } from "@/lib/net/assert-public-url";

export interface CritiqueIssue {
  type: string;
  severity: "minor" | "moderate" | "major";
  description: string;
}

export interface CritiqueResult {
  score: number;
  issues: CritiqueIssue[];
  strengths: string[];
  improvedPrompt: string;
  shouldRegenerate: boolean;
  summary: string;
}

const CRITIQUE_SYSTEM = `You are an expert AI-generated image and video quality reviewer. Your job is to analyze AI-generated content and identify issues that make it look unrealistic, cartoonish, or flawed.

You must return ONLY valid JSON with this exact structure:
{
  "score": <1-10 integer>,
  "issues": [{"type": "<category>", "severity": "<minor|moderate|major>", "description": "<specific issue>"}],
  "strengths": ["<what looks good>"],
  "improvedPrompt": "<rewritten prompt that fixes the issues>",
  "shouldRegenerate": <true if score < 7>,
  "summary": "<one sentence overall assessment>"
}

Issue categories: anatomy, text, realism, lighting, composition, artifacts, architecture, physics, color, texture

Be brutally honest. Common AI issues to look for:
- Extra or missing fingers, distorted hands/faces
- Wrong text, garbled letters or numbers
- Floating objects, physically impossible arrangements
- Flat/cartoon lighting instead of realistic light interaction
- Plastic/waxy skin textures
- Architectural impossibilities (impossible stairs, wrong perspective)
- Repeated patterns that break realism
- Unnatural color saturation or flatness
- Missing shadows or wrong shadow direction
- Objects blending into each other at edges

For the improvedPrompt: rewrite the original prompt with specific fixes — add "photorealistic", specify materials/textures, fix spatial descriptions, add lighting details. Keep it under 200 words.`;

export async function critiqueGeneration(
  imageUrl: string,
  originalPrompt: string,
  type: "image" | "video" = "image",
): Promise<CritiqueResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  // Fetch the image and convert to base64 for Claude (SSRF-guard the URL first).
  await assertPublicUrl(imageUrl);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Detect media type from content-type header or URL
  const contentType = imgRes.headers.get("content-type") || "";
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/png";
  if (contentType.includes("jpeg") || contentType.includes("jpg") || imageUrl.match(/\.jpe?g/i)) mediaType = "image/jpeg";
  else if (contentType.includes("webp") || imageUrl.match(/\.webp/i)) mediaType = "image/webp";
  else if (contentType.includes("gif") || imageUrl.match(/\.gif/i)) mediaType = "image/gif";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: CRITIQUE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Original prompt: "${originalPrompt}"\n\nAnalyze this AI-generated ${type}. Look carefully for any issues with realism, anatomy, text, lighting, physics, or artifacts. Return your analysis as JSON.`,
          },
        ],
      },
    ],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      score: 5,
      issues: [],
      strengths: ["Analysis could not parse results"],
      improvedPrompt: originalPrompt,
      shouldRegenerate: false,
      summary: "Could not complete analysis",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as CritiqueResult;
    return {
      score: Math.min(10, Math.max(1, parsed.score || 5)),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvedPrompt: parsed.improvedPrompt || originalPrompt,
      shouldRegenerate: parsed.shouldRegenerate ?? parsed.score < 7,
      summary: parsed.summary || "Analysis complete",
    };
  } catch {
    return {
      score: 5,
      issues: [],
      strengths: [],
      improvedPrompt: originalPrompt,
      shouldRegenerate: false,
      summary: "Could not parse analysis",
    };
  }
}
