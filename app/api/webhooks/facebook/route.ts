/**
 * Facebook Webhook — receives page message events + verification.
 *
 * Setup: Facebook App → Webhooks → Page → messages subscription
 * Verify Token: Set FACEBOOK_WEBHOOK_VERIFY_TOKEN in env
 *
 * Flow:
 * 1. FB sends message event
 * 2. Auto-respond with business links
 * 3. Forward to Telegram for unified inbox
 * 4. Create lead entry if new contact
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPageReply, getConfiguredPages } from "@/lib/facebook";

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "tolley_fb_webhook_2026";
const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || "8315253075:AAEsWk-38MIJLwcctWsqOu87KiHXrIphS_M";
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || "1680894605";

async function sendTelegram(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch {
    console.error("Telegram send failed");
  }
}

const AUTO_RESPONSE = `Thanks for reaching out! We'll get back to you shortly.

Here's what we offer:
- Washer/Dryer Rentals: tolley.io/wd
- Trailer Rentals: tolley.io/trailer
- Pool Supplies: tolley.io/pools
- Shop & Deals: tolley.io/shop

For immediate help, visit tolley.io or call us!`;

// GET — Webhook verification (Facebook sends this during setup)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST — Incoming message events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Facebook sends batched entries
    for (const entry of body.entry || []) {
      const pageId = entry.id;

      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const message = event.message?.text;
        const timestamp = event.timestamp;

        if (!senderId || !message) continue;

        // Skip messages from the page itself
        if (senderId === pageId) continue;

        console.log(`FB Message from ${senderId}: ${message}`);

        // 1. Forward to Telegram
        await sendTelegram(
          `*📬 FB Message*\nFrom: ${senderId}\nPage: ${pageId}\n\n"${message.slice(0, 500)}"\n\n_Reply in Messenger or Tolley.io dashboard_`
        );

        // 2. Auto-respond (only once per sender per 24h)
        const recentReply = await prisma.siteEvent.findFirst({
          where: {
            site: "fb_autoresponder",
            label: senderId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!recentReply) {
          // Find the page token
          const pages = getConfiguredPages();
          const page = pages.find((p) => p.id === pageId);

          if (page) {
            try {
              await sendPageReply(pageId, page.token, senderId, AUTO_RESPONSE);

              // Track auto-response
              await prisma.siteEvent.create({
                data: {
                  site: "fb_autoresponder",
                  path: "/webhook/facebook",
                  event: "auto_reply",
                  label: senderId,
                  meta: {
                    pageId,
                    incomingMessage: message.slice(0, 200),
                    timestamp,
                  },
                },
              });
            } catch (e) {
              console.error("Auto-reply failed:", e);
            }
          }
        }

        // 3. Create lead entry for new contacts
        const existingLead = await prisma.siteEvent.findFirst({
          where: {
            site: "fb_lead",
            label: senderId,
          },
        });

        if (!existingLead) {
          await prisma.siteEvent.create({
            data: {
              site: "fb_lead",
              path: "/webhook/facebook",
              event: "new_contact",
              label: senderId,
              meta: {
                pageId,
                firstMessage: message.slice(0, 500),
                source: "facebook_messenger",
                timestamp,
              },
            },
          });
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("FB webhook error:", e);
    return NextResponse.json({ status: "ok" }); // Always 200 so FB doesn't retry
  }
}
