/**
 * Prisma loaders for the /hq SMS inbox. Kept off lib/sms-inbox.ts so the
 * grouping helpers stay unit-testable without a database.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildInboxThreads,
  inboxCounts,
  toInboxMessages,
  type InboxRow,
} from "@/lib/sms-inbox";
import { last10Digits } from "@/lib/wd/messaging";

const SMS_LOOKBACK = 800;

const wdSelect = {
  id: true,
  phone: true,
  clientId: true,
  direction: true,
  kind: true,
  status: true,
  body: true,
  aiGenerated: true,
  createdAt: true,
  sentAt: true,
  client: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.WdMessageSelect;

const smsSelect = {
  id: true,
  direction: true,
  body: true,
  status: true,
  createdAt: true,
  conversation: { select: { phoneNumber: true } },
} satisfies Prisma.SmsMessageSelect;

function wdToRow(m: {
  id: string;
  phone: string | null;
  clientId: string | null;
  direction: string;
  kind: string;
  status: string;
  body: string;
  aiGenerated: boolean;
  createdAt: Date;
  sentAt: Date | null;
  client: { id: string; name: string; phone: string | null } | null;
}): InboxRow {
  return {
    id: m.id,
    table: "wd",
    phone: m.phone,
    clientId: m.clientId,
    clientName: m.client?.name ?? null,
    clientPhone: m.client?.phone ?? null,
    direction: m.direction === "inbound" ? "inbound" : "outbound",
    kind: m.kind,
    status: m.status,
    body: m.body,
    aiGenerated: m.aiGenerated,
    createdAt: m.createdAt,
    sentAt: m.sentAt,
  };
}

function smsToRow(m: {
  id: string;
  direction: string;
  body: string;
  status: string;
  createdAt: Date;
  conversation: { phoneNumber: string };
}): InboxRow {
  return {
    id: m.id,
    table: "sms",
    phone: m.conversation.phoneNumber,
    clientId: null,
    clientName: null,
    clientPhone: null,
    direction: m.direction === "inbound" ? "inbound" : "outbound",
    kind: "inbound",
    status: m.status,
    body: m.body,
    aiGenerated: false,
    createdAt: m.createdAt,
    sentAt: m.status === "sent" || m.status === "delivered" ? m.createdAt : null,
  };
}

export async function loadInboxRows(): Promise<InboxRow[]> {
  const [wd, sms] = await Promise.all([
    prisma.wdMessage.findMany({
      where: { channel: "sms" },
      orderBy: { createdAt: "desc" },
      take: SMS_LOOKBACK,
      select: wdSelect,
    }),
    prisma.smsMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: SMS_LOOKBACK,
      select: smsSelect,
    }),
  ]);
  return [...wd.map(wdToRow), ...sms.map(smsToRow)];
}

export async function loadOptedOutKeys(): Promise<Set<string>> {
  const rows = await prisma.smsOptOut.findMany({
    where: { optedOut: true },
    select: { phone: true },
  });
  const keys = new Set<string>();
  for (const row of rows) {
    const key = last10Digits(row.phone);
    if (key) keys.add(key);
  }
  return keys;
}

export async function loadInbox() {
  const [rows, optedOut] = await Promise.all([loadInboxRows(), loadOptedOutKeys()]);
  const threads = buildInboxThreads(rows, optedOut);
  return { threads, counts: inboxCounts(threads), rows };
}

export async function loadInboxThread(phoneKey: string) {
  const key = last10Digits(phoneKey);
  if (!key) return null;
  const { threads, rows } = await loadInbox();
  const thread = threads.find((t) => t.phoneKey === key) ?? null;
  const mine = rows.filter((r) => {
    const k = last10Digits(r.phone) || last10Digits(r.clientPhone);
    return k === key;
  });
  return {
    thread,
    messages: toInboxMessages(mine),
  };
}

/** Active W/D rental client whose phone matches the inbound number (last 10). */
export async function findActiveWdClientByPhone(from: string) {
  const fromDigits = last10Digits(from);
  if (!fromDigits) return null;
  const wdClient = await prisma.wdClient.findFirst({
    where: { active: true, phone: { contains: fromDigits.slice(-7) } },
  });
  if (!wdClient?.phone) return null;
  if (last10Digits(wdClient.phone) !== fromDigits) return null;
  return wdClient;
}
