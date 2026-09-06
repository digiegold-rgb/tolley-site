import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CINEMA_QUEUE_PARAM,
  CINEMA_QUEUE_STORAGE_KEY,
  LONGFORM_QUEUE_PARAM,
  LONGFORM_QUEUE_STORAGE_KEY,
  QUEUE_STUCK_MS,
  SPEND_CONFIRM_USD,
  formatStuckQueueError,
  generateActorAliases,
  isSharedGenerateOperator,
  isStuckInFlightChild,
  latestQueueActorFilter,
  needsSpendConfirm,
  persistBoundQueueId,
  queueGetUrl,
  readBoundQueueId,
} from "./generate-queue-binding.ts";

describe("generate queue binding", () => {
  it("aliases shop-admin and HQ PIN actors so latest is shared", () => {
    assert.deepEqual(generateActorAliases("shop-admin").sort(), ["hq", "shop-admin"]);
    const hq = generateActorAliases("hq:tolley");
    assert.ok(hq.includes("shop-admin"));
    assert.ok(hq.includes("hq:tolley"));
    assert.ok(hq.includes("hq"));
    assert.equal(isSharedGenerateOperator("jared@tolley.io"), false);
    assert.equal(generateActorAliases("jared@tolley.io").join(","), "jared@tolley.io");
    const filter = latestQueueActorFilter("shop-admin");
    assert.ok(typeof filter === "object" && "in" in filter);
    assert.ok(filter.in.includes("shop-admin"));
    assert.ok(filter.in.includes("hq"));
  });

  it("prefers URL id over localStorage and never invents another queue", () => {
    const storage = new Map<string, string>([[LONGFORM_QUEUE_STORAGE_KEY, "stored-old"]]);
    const id = readBoundQueueId({
      search: `?${LONGFORM_QUEUE_PARAM}=url-bound`,
      storage: { getItem: (k) => storage.get(k) ?? null },
      storageKey: LONGFORM_QUEUE_STORAGE_KEY,
      param: LONGFORM_QUEUE_PARAM,
    });
    assert.equal(id, "url-bound");
    assert.equal(
      readBoundQueueId({
        search: "",
        storage: { getItem: (k) => storage.get(k) ?? null },
        storageKey: LONGFORM_QUEUE_STORAGE_KEY,
        param: LONGFORM_QUEUE_PARAM,
      }),
      "stored-old",
    );
  });

  it("persists parent id to storage and URL", () => {
    const storage = new Map<string, string>();
    let href = "/generate";
    persistBoundQueueId({
      id: "cmt-parent-1",
      storage: {
        setItem: (k, v) => {
          storage.set(k, v);
        },
        removeItem: (k) => {
          storage.delete(k);
        },
      },
      storageKey: CINEMA_QUEUE_STORAGE_KEY,
      param: CINEMA_QUEUE_PARAM,
      history: {
        replaceState: (_s, _t, url) => {
          href = String(url);
        },
      },
      search: "",
      pathname: "/generate",
    });
    assert.equal(storage.get(CINEMA_QUEUE_STORAGE_KEY), "cmt-parent-1");
    assert.match(href, /cinema=cmt-parent-1/);
    assert.equal(queueGetUrl("/api/generate/longform", "abc"), "/api/generate/longform?id=abc");
    assert.equal(queueGetUrl("/api/generate/longform", ""), "/api/generate/longform");
  });

  it("flags spend above $5 and stuck children after ~11 min", () => {
    assert.equal(needsSpendConfirm(5), false);
    assert.equal(needsSpendConfirm(5.01), true);
    assert.equal(SPEND_CONFIRM_USD, 5);
    const now = Date.parse("2026-09-06T18:00:00Z");
    assert.equal(
      isStuckInFlightChild(
        { status: "running", startedAt: new Date(now - QUEUE_STUCK_MS - 1000) },
        now,
      ),
      true,
    );
    assert.equal(
      isStuckInFlightChild({ status: "running", startedAt: new Date(now - 60_000) }, now),
      false,
    );
    assert.equal(isStuckInFlightChild({ status: "done", startedAt: new Date(now - QUEUE_STUCK_MS) }, now), false);
    assert.match(formatStuckQueueError(), /Generate is unlocked/);
  });
});
