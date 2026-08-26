/**
 * Operator-only alerts for a Jelly seat request.
 *
 * SMS: one message to Jared (+19132833826) from +19136007508 via the Twilio
 * REST Messages API. Never MessagingServiceSid. Never the Wash & Dry A2P
 * campaign MG82db38fc4ae258c8869e4f0ae6c525ed (CQG8RGM). Never the requester.
 *
 * Email: jared@yourkchomes.com, bcc digiegold@gmail.com.
 */

export const JELLY_OPERATOR_SMS_TO = "+19132833826";
export const JELLY_OPERATOR_SMS_FROM = "+19136007508";
export const JELLY_OPERATOR_EMAIL = "jared@yourkchomes.com";
export const JELLY_OPERATOR_EMAIL_BCC = "digiegold@gmail.com";

/** Wash & Dry verified A2P campaign. Never send Animate operator SMS through it. */
export const WD_A2P_MESSAGING_SERVICE_SID = "MG82db38fc4ae258c8869e4f0ae6c525ed";

const SMS_MAX = 160;

export type SmsStatus = "sent" | "skipped" | "error";
export type EmailStatus = "sent" | "skipped" | "error";

function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  if (n <= 1) return "…";
  return s.slice(0, n - 1) + "…";
}

/** One SMS, ≤160 chars. Requester phone is text in the body, never the recipient. */
export function buildOperatorSmsBody(input: {
  name?: string | null;
  email: string;
  phone?: string | null;
  want?: string | null;
}): string {
  const name = (input.name ?? "").replace(/\s+/g, " ").trim();
  const phone = (input.phone ?? "").replace(/\s+/g, " ").trim();
  const email = input.email.replace(/\s+/g, " ").trim();
  const want = (input.want ?? "").replace(/\s+/g, " ").trim();

  const who = [name, email, phone].filter(Boolean).join(" ");
  const base = `Jelly seat: ${who}`;
  if (!want) return clip(base, SMS_MAX);
  const sep = " — ";
  const budget = SMS_MAX - base.length - sep.length;
  if (budget < 4) return clip(base, SMS_MAX);
  return `${base}${sep}${clip(want, budget)}`;
}

/** Twilio REST Messages form body. To/From are constants — no MessagingServiceSid. */
export function buildOperatorSmsParams(body: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("To", JELLY_OPERATOR_SMS_TO);
  params.set("From", JELLY_OPERATOR_SMS_FROM);
  params.set("Body", body);
  if (params.has("MessagingServiceSid") || params.get("To") !== JELLY_OPERATOR_SMS_TO) {
    throw new Error("Animate operator SMS must go to Jared from the raw From number");
  }
  if (params.toString().includes(WD_A2P_MESSAGING_SERVICE_SID)) {
    throw new Error("Wash & Dry A2P campaign must not be used for Animate operator SMS");
  }
  return params;
}

export function buildOperatorEmail(input: {
  name?: string | null;
  email: string;
  phone?: string | null;
  want?: string | null;
  source?: Record<string, string>;
  referrer?: string | null;
}): { to: string; bcc: string; subject: string; text: string } {
  const who = input.name || input.email;
  const src = input.source ?? {};
  const srcLine = Object.keys(src).length
    ? Object.entries(src).map(([k, v]) => `${k}: ${v}`).join("\n")
    : "—";
  return {
    to: JELLY_OPERATOR_EMAIL,
    bcc: JELLY_OPERATOR_EMAIL_BCC,
    subject: `Jelly seat request — ${who}`,
    text: [
      "Jelly Studio seat request (operator alert — requester was not texted)",
      "",
      `Name:     ${input.name ?? "—"}`,
      `Email:    ${input.email}`,
      `Phone:    ${input.phone ?? "—"}`,
      `Want:     ${input.want ?? "—"}`,
      `Referrer: ${input.referrer ?? "—"}`,
      "",
      "Source / UTM:",
      srcLine,
      "",
      "Log them in: https://www.tolley.io/hq  → Inbox → Approve → mint + email invite",
    ].join("\n"),
  };
}

export async function sendOperatorSeatSms(
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: SmsStatus; sid?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!sid || !token) return { status: "skipped" };

  const params = buildOperatorSmsParams(body);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`, "utf8").toString("base64");

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[animate/seat-request] Twilio SMS failed", res.status, errText.slice(0, 180));
      return { status: "error" };
    }
    const json = (await res.json().catch(() => ({}))) as { sid?: string };
    return { status: "sent", sid: json.sid };
  } catch (err) {
    console.error("[animate/seat-request] Twilio SMS error", err);
    return { status: "error" };
  }
}
