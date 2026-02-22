import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { AGENT_URL } from "@/lib/agent-proxy";
import { prisma } from "@/lib/prisma";
import {
  getPlanLimits,
  getResetAtIso,
  isActiveSubscriptionStatus,
  resolvePlanFromPriceId,
  toBucketDate,
} from "@/lib/subscription";

const SESSION_IDLE_TIMEOUT_MS = Number(
  process.env.SESSION_IDLE_TIMEOUT_MS || 1000 * 60 * 45,
);
export const runtime = "nodejs";

type AskPayload = {
  question?: string;
  intent?: string;
  conversationId?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const startedAt = Date.now();

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as AskPayload;
    const question = payload.question?.trim();
    const conversationId = payload.conversationId?.trim();

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || !isActiveSubscriptionStatus(subscription.status)) {
      return NextResponse.json({ error: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    }

    const planFromPrice = resolvePlanFromPriceId(subscription.priceId);
    const plan = planFromPrice === "none" ? "basic" : planFromPrice;
    const dailyLimit = getPlanLimits(plan);
    const now = new Date();
    const resetAt = getResetAtIso(now);
    const bucketDate = toBucketDate(now);

    const latestBucket = await prisma.usageBucket.findFirst({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
      select: {
        lastSeenAt: true,
      },
    });

    const sessionIssuedAtMs = session.issuedAt
      ? new Date(session.issuedAt).getTime()
      : 0;
    const idleExceeded =
      latestBucket?.lastSeenAt &&
      Date.now() - latestBucket.lastSeenAt.getTime() > SESSION_IDLE_TIMEOUT_MS;
    const sessionIsNotFresh = !sessionIssuedAtMs
      ? true
      : latestBucket
        ? latestBucket.lastSeenAt.getTime() >= sessionIssuedAtMs
        : false;

    if (idleExceeded && sessionIsNotFresh) {
      return NextResponse.json(
        {
          error: "SESSION_EXPIRED",
        },
        { status: 401 },
      );
    }

    const todayBucket = await prisma.usageBucket.findUnique({
      where: {
        userId_bucketDate: {
          userId,
          bucketDate,
        },
      },
    });

    const asksToday = todayBucket?.countAsks || 0;
    if (asksToday >= dailyLimit) {
      return NextResponse.json(
        {
          error: "USAGE_LIMIT_REACHED",
          resetAt,
          usage: {
            remaining: 0,
            limit: dailyLimit,
            resetAt,
            plan,
          },
        },
        { status: 429 },
      );
    }

    const upstreamResponse = await fetch(`${AGENT_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        intent: payload.intent,
        conversationId,
        userId,
      }),
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      );
    }

    const upstreamData = (await upstreamResponse.json()) as {
      answer?: string;
      cards?: Array<{
        type?: string;
        address?: string;
        price?: number;
        beds?: number;
        baths?: number;
        sqft?: number;
        summaryBullets?: string[];
        link?: string;
        source?: string;
      }>;
      followUps?: string[];
      memoryUpdates?: string[];
      requestId?: string;
      cached?: boolean;
      latency?: number;
      conversationId?: string;
    };

    const requestId = upstreamData.requestId || crypto.randomUUID();
    const latencyMs = Math.max(
      1,
      Number.isFinite(upstreamData.latency)
        ? Number(upstreamData.latency)
        : Date.now() - startedAt,
    );
    const countMinutes = Math.max(1, Math.ceil(latencyMs / 60000));

    const updatedBucket = await prisma.usageBucket.upsert({
      where: {
        userId_bucketDate: {
          userId,
          bucketDate,
        },
      },
      create: {
        userId,
        bucketDate,
        countAsks: 1,
        countMinutes,
        lastSeenAt: now,
      },
      update: {
        countAsks: {
          increment: 1,
        },
        countMinutes: {
          increment: countMinutes,
        },
        lastSeenAt: now,
      },
    });

    await prisma.usageEvent.create({
      data: {
        userId,
        type: "ask",
        requestId,
        latencyMs,
        tokensApprox: upstreamData.answer
          ? Math.max(1, Math.ceil(upstreamData.answer.length / 4))
          : null,
      },
    });

    return NextResponse.json({
      answer: upstreamData.answer || "",
      cards: Array.isArray(upstreamData.cards)
        ? upstreamData.cards
            .filter((card) => typeof card.address === "string" && card.address.trim())
            .map((card) => ({
              type: typeof card.type === "string" ? card.type : "listing",
              address: card.address?.trim() || "",
              price: typeof card.price === "number" ? card.price : null,
              beds: typeof card.beds === "number" ? card.beds : null,
              baths: typeof card.baths === "number" ? card.baths : null,
              sqft: typeof card.sqft === "number" ? card.sqft : null,
              summaryBullets: Array.isArray(card.summaryBullets)
                ? card.summaryBullets.filter((bullet) => typeof bullet === "string")
                : [],
              link: typeof card.link === "string" ? card.link : undefined,
              source: typeof card.source === "string" ? card.source : undefined,
            }))
        : [],
      followUps: Array.isArray(upstreamData.followUps)
        ? upstreamData.followUps.filter((item) => typeof item === "string")
        : [],
      memoryUpdates: Array.isArray(upstreamData.memoryUpdates)
        ? upstreamData.memoryUpdates.filter((item) => typeof item === "string")
        : [],
      requestId,
      cached: Boolean(upstreamData.cached),
      latency: latencyMs,
      conversationId: upstreamData.conversationId || conversationId || requestId,
      usage: {
        remaining: Math.max(0, dailyLimit - updatedBucket.countAsks),
        limit: dailyLimit,
        resetAt,
        plan,
      },
    });
  } catch (error) {
    console.error("Agent proxy error:", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
