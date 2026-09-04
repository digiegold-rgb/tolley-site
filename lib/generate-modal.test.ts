import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultJobCard } from "./generate-job-card.ts";
import {
  buildWebhookUrl,
  isModalConfigured,
  modalPublicStatus,
  spawnKwargsForCard,
} from "./generate-modal.ts";

describe("isModalConfigured", () => {
  it("requires both token id and secret and never invents them", () => {
    assert.equal(isModalConfigured({}), false);
    assert.equal(isModalConfigured({ MODAL_TOKEN_ID: "ak-x" }), false);
    assert.equal(isModalConfigured({ MODAL_TOKEN_ID: "ak-x", MODAL_TOKEN_SECRET: "as-y" }), true);
    const status = modalPublicStatus({});
    assert.equal(status.configured, false);
    assert.equal(status.app, "tolley-qwen-image-edit");
    assert.equal(status.functionName, "qwen_image_edit");
    assert.equal(status.recipe, "qwen-image-edit-2511");
  });
});

describe("spawnKwargsForCard", () => {
  it("forwards editable kwargs including identity_ref_urls", () => {
    const card = defaultJobCard("lady2-lacy-pink-front-smile", {
      GENERATE_IDENTITY_REF_URLS: "https://cdn.example/f.jpg,https://cdn.example/l.jpg,https://cdn.example/r.jpg",
    });
    const kw = spawnKwargsForCard(card, { job_id: "j1" });
    assert.equal(kw.identity_ref_urls.length, 3);
    assert.equal(kw.num_images, 1);
    assert.equal(kw.job_id, "j1");
    assert.equal(Object.hasOwn(kw, "token_id"), false);
  });
});

describe("buildWebhookUrl", () => {
  it("uses GENERATE_WEBHOOK_URL or APP_URL", () => {
    assert.equal(
      buildWebhookUrl({ GENERATE_WEBHOOK_URL: "https://tolley.io/api/generate/jobs/webhook" }),
      "https://tolley.io/api/generate/jobs/webhook",
    );
    assert.equal(
      buildWebhookUrl({ APP_URL: "https://tolley.io/" }),
      "https://tolley.io/api/generate/jobs/webhook",
    );
    assert.equal(buildWebhookUrl({}), undefined);
  });
});
