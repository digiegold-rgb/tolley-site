import { jaredGreeting } from "@/lib/jared-voice";
import { buildDirectory } from "@/lib/directory";

/**
 * Deterministic Jared-voice reply drafts for inbound leads (/hq Inbox).
 * Templates only — no LLM, so a draft can never invent pricing or policy.
 * Nothing is stored and nothing sends; the draft prefills a textarea and
 * Jared edits + taps send (POST /api/hq/inbound/[id]/reply).
 */

export interface InboundLeadLike {
  subsite: string;
  action: string;
  name?: string | null;
  email?: string | null;
  structured?: Record<string, unknown> | null;
}

function serviceTitle(subsite: string): string {
  const entry = buildDirectory().find((e) => e.name === subsite);
  return entry?.title ?? subsite;
}

/** One short "you asked about X" line from the structured fields, if any. */
function detailLine(structured: Record<string, unknown> | null | undefined): string {
  if (!structured) return "";
  const skip = new Set(["ref", "source", "receiptToken"]);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(structured)) {
    if (skip.has(k) || v == null || v === "") continue;
    parts.push(`${k}: ${String(v)}`);
    if (parts.length >= 2) break;
  }
  return parts.length ? `I've got your details down (${parts.join(", ")}).` : "";
}

export function draftInboundReply(lead: InboundLeadLike): {
  subject: string;
  body: string;
} {
  const greeting = jaredGreeting(lead.name);
  const service = serviceTitle(lead.subsite);

  if (lead.action === "email_capture") {
    return {
      subject: `thanks for joining — ${service}`,
      body: [
        greeting,
        "",
        `Thanks for signing up over at ${service} — this is Jared, the guy behind it.`,
        "",
        "Is there anything specific you're looking for right now?",
        "If so just reply here and I'll take care of it personally.",
        "",
        "Thank you.",
        "Jared",
      ].join("\n"),
    };
  }

  if (lead.action.startsWith("portal_signup")) {
    return {
      subject: "welcome — next step",
      body: [
        greeting,
        "",
        "Thanks for signing up — this is Jared.",
        "I saw your signup come through and wanted to reach out personally.",
        "",
        "What time this week works for a quick call so I can get you set up?",
        "",
        "Thank you.",
        "Jared",
      ].join("\n"),
    };
  }

  // Default: quote / route-me / structured request from any subsite.
  const detail = detailLine(lead.structured);
  return {
    subject: `your ${service} request`,
    body: [
      greeting,
      "",
      `Thanks for reaching out about ${service} — this is Jared.`,
      ...(detail ? [detail] : []),
      "",
      "When this week is a good time to talk through it?",
      "I can usually get a number to you same day.",
      "",
      "Thank you.",
      "Jared",
    ].join("\n"),
  };
}
