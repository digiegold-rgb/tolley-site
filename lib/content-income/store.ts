import { prisma } from "@/lib/prisma";
import { centralDate, centralInstant } from "@/lib/live/campaign";
import { ACCOUNT_ID, TREASURE_PAGE, actionSchema, receiptTotals, performanceScore, allowedFeedSlots, USED_STATUSES, safeError, morningFormat } from "./core";
import { TOPICS, topicCopy } from "./catalog";
import { graph, verifyPage, MetaRejected } from "./meta";
import type { ContentIncomePost } from "@prisma/client";

export async function ensureAccount() {
  return prisma.contentIncomeAccount.upsert({ where: { id: ACCOUNT_ID }, create: { id: ACCOUNT_ID, externalId: TREASURE_PAGE, label: "Ruthann’s Treasure Haul" }, update: {} });
}
export async function seedQueue(now = new Date()) {
  const account = await ensureAccount();
  if (!account.startedAt) return 0;
  const start = centralDate(account.startedAt);
  const first = centralDate(now);
  const last = new Date(`${first}T12:00:00Z`); last.setUTCDate(last.getUTCDate() + 29);
  if (await prisma.contentIncomePost.findUnique({ where: { accountId_scheduleKey: { accountId: ACCOUNT_ID, scheduleKey: `${last.toISOString().slice(0, 10)}:image` } } })) return 0;
  const rows = [];
  // Rolling 30 days; unique calendar slots make repeated cron/enable idempotent.
  for (let i = 0; i < 30; i++) {
    const d = new Date(`${first}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    const elapsed = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
    for (const format of ["text", "image"] as const) {
      const copy = topicCopy(elapsed + (format === "image" ? 7 : 0), format);
      rows.push({ ...copy, accountId: ACCOUNT_ID, scheduleKey: `${day}:${format}`, scheduledAt: centralInstant(day, format === morningFormat(elapsed) ? "09:30" : "14:30"), status: "queued" });
    }
  }
  return (await prisma.contentIncomePost.createMany({ data: rows, skipDuplicates: true })).count;
}
export async function enable() {
  const verified = await verifyPage();
  const a = await ensureAccount();
  await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { paused: false, startedAt: a.startedAt ?? new Date(), label: verified.label, followers: verified.followers, connectionCheckedAt: new Date(), metricsError: null } });
  const seeded = await seedQueue();
  if (!a.startedAt) {
    const now = new Date(), day = centralDate(now);
    await prisma.contentIncomePost.updateMany({ where: { accountId: ACCOUNT_ID, status: "queued", scheduledAt: { lt: now } }, data: { status: "skipped", error: "Before activation. Historical slots are not replayed." } });
    const image = await prisma.contentIncomePost.findUnique({ where: { accountId_scheduleKey: { accountId: ACCOUNT_ID, scheduleKey: `${day}:image` } } });
    if (image?.status === "skipped") await prisma.contentIncomePost.update({ where: { id: image.id }, data: { scheduledAt: now, status: "queued", error: null } });
  }
  return { seeded };
}

export async function reservePost(id: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('treasure-hauls-facebook'))`;
    const account = await tx.contentIncomeAccount.findUnique({ where: { id: ACCOUNT_ID } });
    const post = await tx.contentIncomePost.findUnique({ where: { id } });
    if (!account || account.paused || account.externalId !== TREASURE_PAGE || !post || post.accountId !== ACCOUNT_ID || post.status !== "queued" || post.scheduledAt > now) return null;
    const day = centralDate(now), since = centralInstant(day, "00:00");
    if (post.scheduledAt < since) return null;
    const nextDay = new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const until = centralInstant(nextDay.toISOString().slice(0, 10), "00:00");
    const [ours, clips, campaigns, uncertain, preview] = await Promise.all([
      tx.contentIncomePost.count({ where: { accountId: ACCOUNT_ID, status: { in: USED_STATUSES }, attemptedAt: { gte: since } } }),
      tx.livePublication.count({ where: { platform: "facebook", accountId: TREASURE_PAGE, createdAt: { gte: since }, status: { notIn: ["failed", "canceled"] } } }),
      tx.liveCampaignPost.count({ where: { platform: "facebook", accountId: TREASURE_PAGE, format: "feed", NOT: { kind: { startsWith: "announce_" } }, status: { in: ["posting", "posted", "uncertain"] }, updatedAt: { gte: since } } }),
      tx.contentIncomePost.count({ where: { accountId: ACCOUNT_ID, status: "uncertain" } }),
      tx.liveCampaignPost.count({ where: { platform: "facebook", accountId: TREASURE_PAGE, kind: "preview", status: "queued", dueAt: { gte: since, lt: until }, expiresAt: { gt: now } } }),
    ]);
    if (!allowedFeedSlots({ used: ours + clips + campaigns, reservedPreview: preview > 0, hasUncertain: uncertain > 0 })) return null;
    const claimed = await tx.contentIncomePost.updateMany({ where: { id, status: "queued" }, data: { status: "sending", attemptedAt: now, error: null } });
    return claimed.count ? post : null;
  });
}
type Sender = (post: ContentIncomePost) => Promise<{ externalId: string; url: string }>;
export async function publishTip(post: ContentIncomePost) {
  const verified = await verifyPage();
  const [account, fresh] = await Promise.all([prisma.contentIncomeAccount.findUnique({ where: { id: ACCOUNT_ID } }), prisma.contentIncomePost.findUnique({ where: { id: post.id } })]);
  if (account?.paused || fresh?.status !== "sending" || fresh.caption !== post.caption || fresh.format !== post.format) throw new MetaRejected("Publishing paused or post changed before submission.");
  const body = new URLSearchParams(post.format === "text" ? { message: post.caption } : { caption: post.caption, url: `https://www.tolley.io/api/content-income/art/${post.id}` });
  const result = await graph(`${TREASURE_PAGE}/${post.format === "text" ? "feed" : "photos"}`, verified.connection.accessToken, body);
  const externalId = post.format === "text" ? result.id : result.post_id;
  if (result.id || result.post_id) await prisma.contentIncomePost.update({ where: { id: post.id }, data: { externalId: externalId || result.id } });
  if (!externalId) throw new Error("Meta accepted media but did not return a published post ID. Reconcile this attempt.");
  const remote = await graph(`${externalId}?fields=id,from,permalink_url,message`, verified.connection.accessToken);
  if (remote.from?.id !== TREASURE_PAGE || remote.message !== post.caption) throw new Error("Meta post identity or copy could not be verified.");
  return { externalId, url: remote.permalink_url || `https://www.facebook.com/${externalId}` };
}
export async function drainQueue(sender: Sender = publishTip, now = new Date()) {
  const account = await ensureAccount();
  if (account.paused) {
    await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { heartbeatAt: now } });
    return { paused: true, published: 0 };
  }
  await seedQueue(now);
  await prisma.contentIncomePost.updateMany({ where: { status: "sending", attemptedAt: { lt: new Date(now.getTime() - 15 * 60000) } }, data: { status: "uncertain", error: "Worker interrupted. Verify the actual post before resuming; no automatic retry." } });
  await prisma.contentIncomePost.updateMany({ where: { status: "queued", scheduledAt: { lt: centralInstant(centralDate(now), "00:00") } }, data: { status: "skipped", error: "Calendar slot passed. Old posts are not replayed in a burst." } });
  let published = 0;
  const due = await prisma.contentIncomePost.findMany({ where: { status: "queued", scheduledAt: { lte: now } }, orderBy: { scheduledAt: "asc" }, take: 2 });
  for (const row of due) {
    const post = await reservePost(row.id, now); if (!post) continue;
    try {
      const result = await sender(post);
      await prisma.contentIncomePost.update({ where: { id: post.id }, data: { ...result, status: "posted", publishedAt: now, error: null } });
      await prisma.postLogEntry.create({ data: { job: "content-income", runId: post.id, channel: "fb", account: TREASURE_PAGE, business: "haul", status: "ok", title: post.headline, url: result.url } });
      published++;
    } catch (error) {
      const checkpoint = await prisma.contentIncomePost.findUnique({ where: { id: post.id }, select: { externalId: true } });
      const status = error instanceof MetaRejected && !checkpoint?.externalId ? "failed" : "uncertain";
      await prisma.contentIncomePost.updateMany({ where: { id: post.id, status: "sending" }, data: { status, error: safeError(error) } });
      await prisma.postLogEntry.create({ data: { job: "content-income", runId: post.id, channel: "fb", account: TREASURE_PAGE, business: "haul", status: "fail", title: post.headline, error: safeError(error) } });
    }
  }
  await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { heartbeatAt: now } });
  return { paused: false, published };
}

export async function syncMetrics() {
  await ensureAccount();
  const verified = await verifyPage();
  await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { followers: verified.followers, connectionCheckedAt: new Date(), metricsError: null } });
  const token = verified.connection.accessToken;
  const rows = await prisma.contentIncomePost.findMany({ where: { accountId: ACCOUNT_ID, status: "posted", publishedAt: { gte: new Date(Date.now() - 30 * 86400000) } }, orderBy: { metricsAt: { sort: "asc", nulls: "first" } }, take: 8 });
  for (const p of rows) {
    const number = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null;
    try {
      const r = await graph(`${p.externalId}?fields=id,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)`, token);
      await prisma.contentIncomePost.update({ where: { id: p.id }, data: { shares: number(r.shares?.count ?? 0), reactions: number(r.reactions?.summary?.total_count), comments: number(r.comments?.summary?.total_count), metricsAt: new Date(), metricsSource: "Meta Graph API · reactions/comments/shares", metricsError: null } });
    } catch (error) { await prisma.contentIncomePost.update({ where: { id: p.id }, data: { metricsError: safeError(error) } }); }
    try {
      const r = await graph(`${p.externalId}/insights?metric=post_media_view&period=lifetime`, token);
      const value = r.data?.find((d: { name: string }) => d.name === "post_media_view")?.values?.[0]?.value;
      if (number(value) === null) throw new Error("Meta returned no post-view count.");
      await prisma.contentIncomePost.update({ where: { id: p.id }, data: { views: number(value), metricsAt: new Date(), metricsSource: "Meta post_media_view · total views, not qualified views" } });
    } catch (error) { await prisma.contentIncomePost.update({ where: { id: p.id }, data: { metricsError: safeError(error) } }); }
  }
  try {
    const since = Math.floor((Date.now() - 30 * 86400000) / 1000), until = Math.floor(Date.now() / 1000);
    const r = await graph(`${TREASURE_PAGE}/insights?metric=content_monetization_earnings&period=day&since=${since}&until=${until}`, token);
    const values = r.data?.find((d: { name: string }) => d.name === "content_monetization_earnings")?.values;
    if (!Array.isArray(values) || !values.length) throw new Error("Meta returned no daily earnings values.");
    for (const v of values) {
      const amount = Number(v.value?.microAmount), endTime = new Date(v.end_time);
      if (v.value?.currency !== "USD" || !Number.isSafeInteger(amount) || amount < 0 || !Number.isFinite(endTime.getTime())) throw new Error("Meta returned an unsupported earnings value; existing records preserved.");
      await prisma.contentIncomeEarningDay.upsert({ where: { accountId_endTime: { accountId: ACCOUNT_ID, endTime } }, create: { accountId: ACCOUNT_ID, endTime, amountMicros: BigInt(amount), currency: "USD" }, update: { amountMicros: BigInt(amount), capturedAt: new Date() } });
    }
    await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { earningsCheckedAt: new Date(), earningsError: null } });
  } catch (error) { await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { earningsError: safeError(error) } }); }
  try {
    await graph(`${TREASURE_PAGE}/insights?metric=creator_monetization_qualified_views&period=day`, token);
    await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { qualifiedViewsError: null } });
  } catch (error) { await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { qualifiedViewsError: safeError(error) } }); }
  return { refreshed: rows.length };
}
export async function report() {
  const account = await ensureAccount();
  const [posts, receipts, earningDays, counts] = await Promise.all([
    prisma.contentIncomePost.findMany({ where: { accountId: ACCOUNT_ID }, orderBy: { scheduledAt: "desc" }, take: 120 }),
    prisma.contentIncomeReceipt.findMany({ where: { accountId: ACCOUNT_ID }, orderBy: { createdAt: "desc" } }),
    prisma.contentIncomeEarningDay.findMany({ where: { accountId: ACCOUNT_ID, endTime: { gte: new Date(Date.now() - 30 * 86400000) } }, orderBy: { endTime: "asc" } }),
    prisma.contentIncomePost.groupBy({ by: ["status"], where: { accountId: ACCOUNT_ID }, _count: { _all: true } }),
  ]);
  const micros = earningDays.reduce((n, d) => n + d.amountMicros, BigInt(0));
  const performance = posts.map(p => ({ ...p, score: performanceScore(p) }));
  const winners = performance.filter(p => p.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
  return { account, posts: performance, winners, receipts, totals: receiptTotals(receipts), counts, estimatedCents: earningDays.length ? Number(micros / BigInt(10000)) : null, earningDays: earningDays.map(d => ({ endTime: d.endTime, amountCents: Number(d.amountMicros) / 10000, capturedAt: d.capturedAt })), topics: TOPICS.length };
}
export async function act(raw: unknown) {
  const a = actionSchema.parse(raw); await ensureAccount();
  if (a.action === "enable") return enable();
  if (a.action === "pause") return a.paused ? prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { paused: true } }) : enable();
  if (a.action === "sync") return syncMetrics();
  if (a.action === "verify") return prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { programStatus: a.programStatus, payoutsVerified: a.payoutsVerified, programEvidence: a.evidence, programVerifiedAt: new Date() } });
  if (a.action === "metrics") {
    const p = await prisma.contentIncomePost.findUniqueOrThrow({ where: { id: a.postId } });
    if (p.accountId !== ACCOUNT_ID || p.status !== "posted") throw new Error("Choose a published Treasure Haul experiment.");
    const measuredAt = new Date(a.measuredAt);
    if (measuredAt > new Date() || measuredAt < (p.publishedAt ?? p.createdAt) || (p.metricsAt && measuredAt < p.metricsAt)) throw new Error("Use a current measurement taken after publication.");
    return prisma.contentIncomePost.update({ where: { id: p.id }, data: { views: a.views, qualifiedViews: a.qualifiedViews, reactions: a.reactions, comments: a.comments, shares: a.shares, follows: a.follows, earningsCents: a.earningsCents, metricsSource: a.evidence, metricsAt: measuredAt, ownerMetricsAt: measuredAt, ownerMetricsEvidence: a.evidence, metricsError: null } });
  }
  if (a.action === "receipt") return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('content-income-receipts'))`;
    const where = { accountId_externalId: { accountId: ACCOUNT_ID, externalId: a.externalId } };
    const old = await tx.contentIncomeReceipt.findUnique({ where });
    if (old && (old.amountCents !== a.amountCents || old.period !== a.period || (old.status === "paid" && a.status === "pending") || (old.status === "reversed" && a.status !== "reversed"))) throw new Error("Receipt conflicts with existing evidence or moves backwards.");
    const data = { accountId: ACCOUNT_ID, externalId: a.externalId, amountCents: a.amountCents, status: a.status, period: a.period, evidence: a.evidence };
    return tx.contentIncomeReceipt.upsert({ where, create: data, update: { status: a.status, evidence: a.evidence } });
  });
  if (a.action === "reconcile") {
    const p = await prisma.contentIncomePost.findUniqueOrThrow({ where: { id: a.postId } });
    if (p.accountId !== ACCOUNT_ID || !["uncertain", "sending"].includes(p.status) || !a.externalId.startsWith(TREASURE_PAGE + "_")) throw new Error("Choose an uncertain post and its Treasure Haul post ID.");
    const v = await verifyPage(), remote = await graph(`${a.externalId}?fields=id,from,message,created_time,permalink_url`, v.connection.accessToken);
    if (remote.from?.id !== TREASURE_PAGE || remote.message !== p.caption) throw new Error("Post account or copy does not match this attempt.");
    const publishedAt = new Date(remote.created_time);
    if (!Number.isFinite(publishedAt.getTime()) || publishedAt < new Date((p.attemptedAt ?? p.createdAt).getTime() - 60000)) throw new Error("Post publication time does not match this attempt.");
    const url = remote.permalink_url || `https://www.facebook.com/${a.externalId}`;
    return prisma.$transaction(async tx => {
      const changed = await tx.contentIncomePost.updateMany({ where: { id: p.id, status: { in: ["uncertain", "sending"] } }, data: { status: "posted", externalId: a.externalId, url, publishedAt, error: null } });
      if(changed.count) await tx.postLogEntry.create({ data: { job: "content-income", runId: p.id, channel: "fb", account: TREASURE_PAGE, business: "haul", status: "ok", title: p.headline, url } });
      return { reconciled: changed.count === 1 };
    });
  }
}
