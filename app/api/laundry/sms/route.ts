import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";
import {
  classifySmsKeyword,
  normalizePhone,
  recordOptOut,
  recordOptIn,
  isOptedOut,
} from "@/lib/sms-optout";
import { consumeRateLimit } from "@/lib/rate-limit";
import { answerMessage } from "@/lib/laundry/assistant";
import { runLaundryWorker } from "@/lib/laundry/worker";
import { BASE, PHONE } from "@/lib/laundry/config";
export const maxDuration = 60;
function xml(text = "") {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</Message>` : ""}</Response>`,
    { headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  const form = await req.formData(),
    p = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  if (
    !validateTwilioSignature(
      `${BASE}/api/laundry/sms`,
      p,
      req.headers.get("x-twilio-signature") || "",
    )
  )
    return new Response("Forbidden", { status: 403 });
  if (
    !process.env.LAUNDRY_MESSAGING_SERVICE_SID ||
    p.MessagingServiceSid !== process.env.LAUNDRY_MESSAGING_SERVICE_SID
  )
    return new Response("Unknown messaging service", { status: 403 });
  const phone = normalizePhone(p.From);
  if (!phone) return xml();
  const keyword = classifySmsKeyword(p.Body);
  if (keyword === "stop") {
    await recordOptOut(phone, { source: "laundry", keyword: "STOP" });
    return xml(
      p.OptOutType
        ? ""
        : "You are unsubscribed from Laundry Rental Network texts. Reply START to opt back in.",
    );
  }
  if (keyword === "start") {
    await recordOptIn(phone, { source: "laundry", keyword: "START" });
    return xml(
      p.OptOutType
        ? ""
        : "Laundry Rental Network texts are enabled. Reply STOP to stop or HELP for help.",
    );
  }
  if (keyword === "help")
    return xml(
      `Laundry Rental Network automated rental support. Call ${PHONE}. Reply STOP to stop. Message/data rates may apply.`,
    );
  if (await isOptedOut(phone)) return xml();
  if (!(await consumeRateLimit(`laundry-sms:${phone}`, 15, 3600)).allowed)
    return xml(`Please call ${PHONE} for further help.`);
  const leads = await prisma.laundryLead.findMany({
    where: {
      phone,
      smsConsent: true,
      status: { in: ["requested", "accepted", "booked", "waitlisted"] },
    },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  if (leads.length !== 1)
    return xml(
      `This is Laundry Rental Network’s automated assistant. Use your private request link or call ${PHONE} so we can find the right rental.`,
    );
  if (!/^SM[a-f0-9]{32}$/i.test(p.MessageSid || ""))
    return new Response("Invalid message", { status: 400 });
  await prisma.laundryMessage.upsert({
    where: { id: p.MessageSid },
    create: {
      id: p.MessageSid,
      phone,
      leadId: leads[0].id,
      body: (p.Body || "").slice(0, 3000),
    },
    update: {},
  });
  after(async () => {
    await answerMessage(p.MessageSid);
    await runLaundryWorker();
  });
  return xml();
}
