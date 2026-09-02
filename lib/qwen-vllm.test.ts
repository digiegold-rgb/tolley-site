import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QWEN_DEFAULT_MODEL,
  QwenVllmConfigError,
  isQwenConfigured,
  qwenChatCompletion,
  qwenChatCompletionsUrl,
  qwenPublicStatus,
  readQwenVllmConfig,
} from "./qwen-vllm.ts";

describe("qwenChatCompletionsUrl", () => {
  it("appends /chat/completions to a /v1 base", () => {
    assert.equal(
      qwenChatCompletionsUrl("http://127.0.0.1:8357/v1"),
      "http://127.0.0.1:8357/v1/chat/completions",
    );
  });

  it("accepts a full completions URL", () => {
    assert.equal(
      qwenChatCompletionsUrl("https://spark.example/v1/chat/completions"),
      "https://spark.example/v1/chat/completions",
    );
  });

  it("adds /v1/chat/completions when only the host is given", () => {
    assert.equal(
      qwenChatCompletionsUrl("https://YOUR-SPARK-HOST"),
      "https://YOUR-SPARK-HOST/v1/chat/completions",
    );
  });
});

describe("readQwenVllmConfig", () => {
  it("requires QWEN_VLLM_BASE_URL and does not invent a paid API host", () => {
    assert.throws(
      () => readQwenVllmConfig({}),
      (err: unknown) => err instanceof QwenVllmConfigError && /QWEN_VLLM_BASE_URL/.test((err as Error).message),
    );
    assert.equal(isQwenConfigured({}), false);
    const status = qwenPublicStatus({});
    assert.equal(status.configured, false);
    assert.equal(status.provider, "qwen-vllm");
    assert.equal(status.model, null);
  });

  it("defaults the unlocked Qwen 3.8 model id and strips none-keys", () => {
    const cfg = readQwenVllmConfig({
      QWEN_VLLM_BASE_URL: "http://10.0.0.8:8357/v1/",
      QWEN_VLLM_API_KEY: "none",
    });
    assert.equal(cfg.model, QWEN_DEFAULT_MODEL);
    assert.match(cfg.model, /Qwen3\.8/);
    assert.equal(cfg.apiKey, null);
    assert.equal(cfg.completionsUrl, "http://10.0.0.8:8357/v1/chat/completions");
    assert.equal(qwenPublicStatus({ QWEN_VLLM_BASE_URL: "http://10.0.0.8:8357/v1" }).configured, true);
  });

  it("uses QWEN_VLLM_MODEL when set", () => {
    const cfg = readQwenVllmConfig({
      QWEN_VLLM_BASE_URL: "https://YOUR-SPARK-HOST/v1",
      QWEN_VLLM_MODEL: "Qwen/Qwen3.8-27B",
      QWEN_VLLM_API_KEY: "sk-test",
    });
    assert.equal(cfg.model, "Qwen/Qwen3.8-27B");
    assert.equal(cfg.apiKey, "sk-test");
  });
});

describe("qwenChatCompletion", () => {
  it("POSTs OpenAI-shaped /v1/chat/completions with the configured model", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(
        JSON.stringify({
          model: "KarlKinda/Qwen3.8-27B-Uncensored-FP8",
          choices: [{ message: { content: "<think>skip</think>\nHello from Spark." } }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await qwenChatCompletion(
      [{ role: "user", content: "hi" }],
      {
        env: {
          QWEN_VLLM_BASE_URL: "http://127.0.0.1:8357/v1",
          QWEN_VLLM_MODEL: "KarlKinda/Qwen3.8-27B-Uncensored-FP8",
        },
        fetchImpl: fetchImpl as typeof fetch,
      },
    );

    assert.equal(result.text, "Hello from Spark.");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:8357/v1/chat/completions");
    const body = JSON.parse(String(calls[0].init.body)) as {
      model: string;
      messages: unknown[];
      max_tokens: number;
    };
    assert.equal(body.model, "KarlKinda/Qwen3.8-27B-Uncensored-FP8");
    assert.equal(body.messages.length, 1);
    assert.ok(body.max_tokens > 0);
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
  });
});
