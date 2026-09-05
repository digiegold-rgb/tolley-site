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

  it("forwards guidance_scale, negative_prompt, and num_images from a patched card", () => {
    const card = {
      ...defaultJobCard("lady2-lacy-pink-front-smile", {
        GENERATE_IDENTITY_REF_URLS: "https://cdn.example/f.jpg,https://cdn.example/l.jpg,https://cdn.example/r.jpg",
      }),
      guidance_scale: 1.7,
      negative_prompt: "identity drift, child, watermark",
      num_images: 4,
      seed: 404,
    };
    const kw = spawnKwargsForCard(card);
    assert.equal(kw.guidance_scale, 1.7);
    assert.equal(kw.negative_prompt, "identity drift, child, watermark");
    assert.equal(kw.num_images, 4);
    assert.equal(kw.seed, 404);
    assert.equal(kw.max_sequence_length, 512);
    assert.deepEqual(kw.extra_image_urls, []);
    assert.equal(Object.hasOwn(kw, "sigmas"), false);
    assert.deepEqual(kw.identity_ref_urls, [
      "https://cdn.example/f.jpg",
      "https://cdn.example/l.jpg",
      "https://cdn.example/r.jpg",
    ]);
  });

  it("forwards max_sequence_length, extra_image_urls, and omits empty sigmas", () => {
    const card = {
      ...defaultJobCard("lady2-lacy-pink-front-smile", {
        GENERATE_IDENTITY_REF_URLS: "https://cdn.example/f.jpg",
      }),
      max_sequence_length: 768,
      extra_image_urls: ["https://cdn.example/style.jpg"],
      sigmas: [1, 0.5],
    };
    const kw = spawnKwargsForCard(card);
    assert.equal(kw.max_sequence_length, 768);
    assert.deepEqual(kw.extra_image_urls, ["https://cdn.example/style.jpg"]);
    assert.deepEqual(kw.sigmas, [1, 0.5]);
    const bare = spawnKwargsForCard({ ...card, sigmas: null });
    assert.equal(Object.hasOwn(bare, "sigmas"), false);
  });

  it("forwards sanitized pipe_overrides and strips secrets", () => {
    const card = {
      ...defaultJobCard("lady2-lacy-pink-front-smile", {
        GENERATE_IDENTITY_REF_URLS: "https://cdn.example/f.jpg",
      }),
      pipe_overrides: {
        guidance_rescale: 0.4,
        api_key: "nope",
        path: "/home/jelly/x",
      },
    };
    const kw = spawnKwargsForCard(card, { job_id: "j2" });
    assert.deepEqual(kw.pipe_overrides, { guidance_rescale: 0.4 });
    assert.equal(kw.job_id, "j2");
    assert.doesNotMatch(JSON.stringify(kw), /api_key|\/home\/jelly/);
  });
});

describe("buildWebhookUrl", () => {
  it("uses GENERATE_WEBHOOK_URL or APP_URL", () => {
    assert.equal(
      buildWebhookUrl({ GENERATE_WEBHOOK_URL: "https://tolley.io/api/generate/webhook" }),
      "https://tolley.io/api/generate/webhook",
    );
    assert.equal(
      buildWebhookUrl({ APP_URL: "https://tolley.io/" }),
      "https://tolley.io/api/generate/webhook",
    );
    assert.equal(buildWebhookUrl({}), undefined);
  });
});
