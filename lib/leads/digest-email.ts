/**
 * lib/leads/digest-email.ts
 *
 * KC Motivated-Seller Brief — Monday morning email.
 *
 * Uses the same Nodemailer SMTP that food/email.ts uses (NextAuth EMAIL_SERVER_*
 * env vars), so there's nothing new to configure. Sends inline HTML — recipients
 * see 10 lead cards in their inbox without clicking through. Each card links
 * back to the full dossier on tolley.io for the operator (Cordless) to dig in
 * if a customer asks.
 */

import type { DigestSubscriber } from "./digest-subscribers";
import { getLeadsTransporter, leadsEmailFrom } from "./email-transport";

const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "https://www.tolley.io";

export interface DigestLead {
  dossierId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  daysOnMarket: number | null;
  motivationScore: number | null;
  motivationFlags: string[];
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerAge: string | null;
  ownerMailingAddress: string | null;
  summary: string | null;
}

const DEFAULT_SCRIPT = `Hi {{ownerName}}, I'm {{agentName}} with Tolley — I work the {{zip}} area and noticed your home at {{address}} came up in some public records that caught my eye. No pressure at all, just wanted to introduce myself in case you've ever thought about your options. Always happy to share what's selling around you, no strings. — {{agentName}}`;

function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtScoreBadge(score: number | null): string {
  if (score == null)
    return `<span style="background:#eee;color:#666;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">unscored</span>`;
  const color = score >= 75 ? "#1e8449" : score >= 50 ? "#b7791f" : "#7f8c8d";
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">${score}/100</span>`;
}

function fmtFlags(flags: string[]): string {
  if (!flags || flags.length === 0) return "";
  return flags
    .slice(0, 4)
    .map(
      (f) =>
        `<span style="background:#fef0e6;color:#9a4a00;padding:1px 6px;border-radius:8px;font-size:10px;margin-right:4px;display:inline-block">${f}</span>`,
    )
    .join("");
}

function fmtContactPills(lead: DigestLead): string {
  const pills: string[] = [];
  if (lead.ownerPhone) {
    const tel = lead.ownerPhone.replace(/[^\d+]/g, "");
    pills.push(
      `<a href="tel:${tel}" style="display:inline-block;background:#1e8449;color:#fff;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;text-decoration:none;margin-right:6px">📞 ${lead.ownerPhone}</a>`,
    );
  }
  if (lead.ownerEmail) {
    pills.push(
      `<a href="mailto:${lead.ownerEmail}" style="display:inline-block;background:#1a3a5c;color:#fff;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;text-decoration:none;margin-right:6px">✉ ${lead.ownerEmail}</a>`,
    );
  }
  if (pills.length === 0) {
    pills.push(
      `<span style="display:inline-block;background:#f1f5f9;color:#64748b;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600">research target — pull owner via Jackson Co assessor</span>`,
    );
  }
  return `<div style="margin-bottom:8px">${pills.join("")}</div>`;
}

function leadCardHtml(lead: DigestLead, idx: number, scriptTpl: string): string {
  const dossierLink = `${appUrl}/leads/dossier/${lead.dossierId}`;
  const fullAddr = [lead.address, lead.city, lead.state, lead.zip]
    .filter(Boolean)
    .join(", ");
  const stats = [
    lead.beds != null ? `${lead.beds} bd` : null,
    lead.baths != null ? `${lead.baths} ba` : null,
    lead.sqft != null ? `${lead.sqft.toLocaleString()} sqft` : null,
    lead.daysOnMarket != null ? `${lead.daysOnMarket} DOM` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const ownerLine = [
    lead.ownerName ? `<b>${lead.ownerName}</b>` : null,
    lead.ownerAge ? `age ${lead.ownerAge}` : null,
    lead.ownerMailingAddress &&
    lead.ownerMailingAddress.toLowerCase() !== fullAddr.toLowerCase()
      ? `mails to: ${lead.ownerMailingAddress}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const filledScript = scriptTpl
    .replace(/\{\{ownerName\}\}/g, lead.ownerName || "there")
    .replace(/\{\{address\}\}/g, lead.address)
    .replace(/\{\{zip\}\}/g, lead.zip || "your area")
    .replace(/\{\{agentName\}\}/g, "[your name]");
  return `
<div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px;background:#fff">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <div style="font-weight:700;font-size:14px;color:#1a3a5c">#${idx + 1} · ${fullAddr}</div>
    ${fmtScoreBadge(lead.motivationScore)}
  </div>
  ${ownerLine ? `<div style="color:#333;font-size:12px;margin-bottom:6px">${ownerLine}</div>` : ""}
  <div style="color:#555;font-size:12px;margin-bottom:6px">
    ${fmtPrice(lead.listPrice)} · ${stats}
  </div>
  ${fmtContactPills(lead)}
  <div style="margin-bottom:8px">${fmtFlags(lead.motivationFlags)}</div>
  ${
    lead.summary
      ? `<div style="color:#222;font-size:13px;line-height:1.45;margin-bottom:10px">${lead.summary}</div>`
      : ""
  }
  <details style="margin-bottom:8px">
    <summary style="cursor:pointer;color:#1a3a5c;font-size:12px;font-weight:600">Outreach script (tap to open)</summary>
    <div style="background:#f7fafc;border-left:3px solid #1a3a5c;padding:8px 10px;margin-top:6px;font-size:12px;line-height:1.5;color:#333;font-family:Georgia,serif">${filledScript}</div>
  </details>
  <a href="${dossierLink}" style="color:#1a3a5c;font-size:12px;font-weight:600;text-decoration:none">→ Full dossier on tolley.io</a>
</div>`;
}

export interface SendDigestEmailOptions {
  subscriber: DigestSubscriber;
  leads: DigestLead[];
  weekOf: string; // human label e.g. "May 5, 2026"
  /** Optional one-line ops warning (e.g. stale MLS sync) shown above the cards. */
  warningLine?: string | null;
  /** Optional one-click pause link rendered as a small footer link. */
  unsubscribeUrl?: string | null;
}

export async function sendDigestEmail(opts: SendDigestEmailOptions): Promise<void> {
  const { subscriber, leads, weekOf, warningLine, unsubscribeUrl } = opts;
  const trialPrefix = subscriber.status === "trial" ? "[Trial] " : "";
  const subject = `${trialPrefix}KC Motivated-Seller Brief · ${weekOf} · ${leads.length} leads`;
  const scriptTpl = subscriber.customScriptTemplate || DEFAULT_SCRIPT;

  const cards = leads.map((l, i) => leadCardHtml(l, i, scriptTpl)).join("");

  const html = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222">
<div style="max-width:680px;margin:0 auto;padding:20px">
  <div style="background:#1a3a5c;color:#fff;padding:18px 20px;border-radius:8px 8px 0 0">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em">KC Motivated-Seller Brief</div>
    <div style="font-size:13px;opacity:0.85;margin-top:2px">Week of ${weekOf} · ${subscriber.name} · ${leads.length} leads in farm area</div>
  </div>
  <div style="background:#fff;padding:14px 16px;border-radius:0 0 8px 8px">
    ${
      warningLine
        ? `<div style="background:#fdecea;border-left:3px solid #c0392b;padding:8px 12px;font-size:12px;line-height:1.4;margin-bottom:12px;color:#7b241c;font-weight:600">${warningLine}</div>`
        : ""
    }
    <div style="background:#fef9c3;border-left:3px solid #b7791f;padding:10px 12px;font-size:12px;line-height:1.45;margin-bottom:14px;color:#5a4400">
      <b>How to use this:</b> Each lead has a motivation score, surfacing flags from public records (probate, NOD, expired listing, etc.), and a starter outreach script. Pick 3–5 you can call/text this week. The full dossier link gives you owner phone/email, deed history, and the synthesis narrative.
    </div>
    ${cards}
  </div>
  <div style="text-align:center;margin-top:16px;color:#777;font-size:11px">
    Curated personally by Jared Tolley · KC metro · Reply to this email anytime · <a href="${appUrl}/leads/dossier" style="color:#1a3a5c">View on tolley.io</a>
  </div>
  ${
    unsubscribeUrl
      ? `<div style="text-align:center;margin-top:8px;font-size:10px"><a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline">Pause your digest</a></div>`
      : ""
  }
</div>
</body></html>`;

  const text = `KC Motivated-Seller Brief — Week of ${weekOf}
${warningLine ? `${warningLine}\n` : ""}${leads.length} leads for ${subscriber.name}

${leads
  .map(
    (l, i) =>
      `${i + 1}. ${l.address} ${l.city ? l.city + ", " : ""}${l.state || ""} ${l.zip || ""}
   Score: ${l.motivationScore ?? "—"}/100 · Flags: ${l.motivationFlags.slice(0, 4).join(", ") || "—"}
   ${l.summary || ""}
   Full: ${appUrl}/leads/dossier/${l.dossierId}
`,
  )
  .join("\n")}

— Jared @ Tolley.io
${unsubscribeUrl ? `\nPause your digest: ${unsubscribeUrl}\n` : ""}`;

  await getLeadsTransporter().sendMail({
    from: leadsEmailFrom,
    to: subscriber.email,
    subject,
    text,
    html,
  });
}
