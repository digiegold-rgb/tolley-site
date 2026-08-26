import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInboxThreads,
  formatPhoneDisplay,
  inboxCounts,
  last10Digits,
  mergeInboxRows,
  toInboxMessages,
  type InboxRow,
} from "./sms-inbox";

function row(partial: Partial<InboxRow> & Pick<InboxRow, "id" | "body">): InboxRow {
  return {
    table: "wd",
    phone: "+19132833826",
    clientId: null,
    clientName: null,
    clientPhone: null,
    direction: "inbound",
    kind: "inbound",
    status: "received",
    aiGenerated: false,
    createdAt: new Date("2026-08-26T12:00:00Z"),
    sentAt: null,
    ...partial,
  };
}

describe("last10Digits / formatPhoneDisplay", () => {
  it("normalizes E.164, 10-digit, and formatted numbers", () => {
    assert.equal(last10Digits("+19132833826"), "9132833826");
    assert.equal(last10Digits("(913) 283-3826"), "9132833826");
    assert.equal(last10Digits("2833826"), null);
    assert.equal(formatPhoneDisplay("+19132833826"), "(913) 283-3826");
  });
});

describe("mergeInboxRows", () => {
  it("drops a T-Agent copy of the same W/D inbound", () => {
    const merged = mergeInboxRows([
      row({ id: "wd1", table: "wd", body: "machine is leaking" }),
      row({
        id: "sms1",
        table: "sms",
        body: "machine is leaking",
        createdAt: new Date("2026-08-26T12:00:02Z"),
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, "wd1");
  });

  it("keeps distinct messages and hides skipped drafts", () => {
    const merged = mergeInboxRows([
      row({ id: "in", body: "hi" }),
      row({
        id: "draft",
        direction: "outbound",
        kind: "ai_reply",
        status: "skipped",
        body: "old draft",
        createdAt: new Date("2026-08-26T12:01:00Z"),
      }),
      row({
        id: "sent",
        direction: "outbound",
        kind: "manual",
        status: "sent",
        body: "on my way",
        createdAt: new Date("2026-08-26T12:02:00Z"),
      }),
    ]);
    assert.deepEqual(
      merged.map((m) => m.id),
      ["in", "sent"],
    );
  });
});

describe("buildInboxThreads", () => {
  it("names a W/D thread, flags unread + needs-send, and sorts those first", () => {
    const threads = buildInboxThreads([
      row({
        id: "a1",
        phone: "+15555551212",
        body: "old unmatched",
        createdAt: new Date("2026-08-26T10:00:00Z"),
      }),
      row({
        id: "b1",
        phone: "+19132833826",
        clientId: "wd_test_e79aa230490a65b0",
        clientName: "Jared Tolley",
        body: "can you come thursday",
        createdAt: new Date("2026-08-26T11:00:00Z"),
      }),
      row({
        id: "b2",
        phone: "+19132833826",
        clientId: "wd_test_e79aa230490a65b0",
        clientName: "Jared Tolley",
        direction: "outbound",
        kind: "ai_reply",
        status: "draft",
        body: "Thursday works — morning or afternoon?",
        aiGenerated: true,
        createdAt: new Date("2026-08-26T11:00:05Z"),
      }),
    ]);

    assert.equal(threads.length, 2);
    assert.equal(threads[0].name, "Jared Tolley");
    assert.equal(threads[0].source, "wd");
    assert.equal(threads[0].needsSend, true);
    assert.equal(threads[0].unread, true);
    assert.equal(threads[0].draftId, "b2");
    assert.equal(threads[0].phoneKey, "9132833826");
    assert.equal(threads[1].source, "unmatched");
    assert.equal(threads[0].smsUndeliverable, false);
    assert.equal(inboxCounts(threads).needsSend, 1);
    assert.equal(inboxCounts(threads).unread, 2);
  });

  it("marks a thread dead when its phone is on an undeliverable client", () => {
    const threads = buildInboxThreads(
      [
        row({
          id: "d1",
          phone: "+18169526445",
          clientId: "cmmobyxk3005al4h1tq7uuhxm",
          clientName: "Hanna Hawkins/Korey",
          body: "old bounce",
        }),
      ],
      new Set(),
      new Map([["8169526445", "30003"]]),
    );
    assert.equal(threads[0].smsUndeliverable, true);
    assert.equal(threads[0].smsErrorCode, "30003");
  });

  it("labels T-Agent-only history as tagent", () => {
    const threads = buildInboxThreads([
      row({
        id: "s1",
        table: "sms",
        phone: "+18165550199",
        body: "what's my listing worth",
        kind: "inbound",
        status: "received",
      }),
    ]);
    assert.equal(threads[0].source, "tagent");
    assert.equal(threads[0].name, null);
  });
});

describe("toInboxMessages", () => {
  it("marks only W/D draft/failed outbound as sendable", () => {
    const msgs = toInboxMessages([
      row({ id: "in", body: "hey" }),
      row({
        id: "draft",
        direction: "outbound",
        kind: "ai_reply",
        status: "draft",
        body: "Got it — I'll follow up.",
        createdAt: new Date("2026-08-26T12:01:00Z"),
      }),
    ]);
    assert.equal(msgs[0].sendable, false);
    assert.equal(msgs[1].sendable, true);
  });
});
