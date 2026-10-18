import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { body, endpoint, json } from "@/lib/company/auth";
import { controlCommand } from "@/lib/company/control";
import { CompanyError } from "@/lib/company/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return endpoint(async () => {
  const expected = process.env.COMPANY_TELEGRAM_WEBHOOK_SECRET;
  const supplied = req.headers.get("x-tolley-telegram-secret") || req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new CompanyError("unauthorized", 401);
  const update = await body(req);
  const message = update?.message;
  if (!message || String(message.from?.id) !== process.env.COMPANY_TELEGRAM_OWNER_ID || String(message.chat?.id) !== process.env.COMPANY_TELEGRAM_CHAT_ID) return json({ accepted: false });
  const match = typeof message.text === "string" ? message.text.match(/^\s*(?:COMPANY|TOLLEY)\s+(STATUS|PAUSE|RESUME|STOP|APPROVE|REJECT|ROLLBACK|ADMISSION)\b\s*(.*?)\s*$/i) : null;
  if (!match) return json({ accepted: false });
  if (!Number.isSafeInteger(update.update_id)) throw new CompanyError("invalid_update");
  const key = `telegram:webhook:${update.update_id}`;
  let result: string;
  try { const response = await controlCommand(match[1].toUpperCase(), match[2].slice(0, 150), key); result = (response as { message?: string }).message || "Command recorded."; }
  catch (error) { if (!(error instanceof CompanyError)) throw error; result = `Command could not be applied: ${error.code}.`; }
  await prisma.companyEvent.upsert({ where: { key }, create: { key, kind: "telegram.command", data: { command: match[1].toUpperCase() } }, update: {} });
  await prisma.companyOutbox.upsert({ where: { id: `reply:${key}` }, create: { id: `reply:${key}`, channel: "telegram", payload: { text: result } }, update: {} });
  return json({ accepted: true });
}); }
