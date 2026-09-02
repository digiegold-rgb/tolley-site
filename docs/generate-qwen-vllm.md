# Point Generate chat at Qwen 3.8 on Spark

`/generate` talks to **Qwen 3.8 Unlocked** on the DGX Spark through an OpenAI-compatible vLLM endpoint. It does **not** call Alibaba Qwen-Max or Claude.

Chat is the director: it writes the **Inference** (engine prompt) and **Description** (identity / outfit / camera notes) boxes. Generate still hits the existing `/api/admin/quickgen` engines (HQ-gated). `/animate`, billing, and auth are unchanged.

## Environment variables (Vercel + `.env.local`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `QWEN_VLLM_BASE_URL` | **yes** | `http://127.0.0.1:8357/v1` | Spark vLLM base. No trailing slash required. Client POSTs `{base}/chat/completions`. |
| `QWEN_VLLM_MODEL` | no | `KarlKinda/Qwen3.8-27B-Uncensored-FP8` | Must match the model id vLLM is serving. Default is this unlocked 3.8 id. |
| `QWEN_VLLM_API_KEY` | no | `none` | Bearer token if the tunnel/LiteLLM requires one. Omit or set `none` for open LAN vLLM. |

Do not put the Spark URL or key in source. If the live tunnel hostname is unknown, leave `QWEN_VLLM_BASE_URL` unset until you have it — chat returns 503 with a pointer here; the Inference / Description boxes still work.

### Typical Spark shapes

```bash
# LAN / tailnet (vLLM default OpenAI mount)
QWEN_VLLM_BASE_URL=http://<spark-lan-ip>:8357/v1
QWEN_VLLM_MODEL=KarlKinda/Qwen3.8-27B-Uncensored-FP8
QWEN_VLLM_API_KEY=none

# Cloudflare / LiteLLM tunnel (only if THAT process is serving Qwen 3.8 Unlocked)
QWEN_VLLM_BASE_URL=https://YOUR-SPARK-HOST/v1
QWEN_VLLM_MODEL=KarlKinda/Qwen3.8-27B-Uncensored-FP8
QWEN_VLLM_API_KEY=<scoped-virtual-key>
```

Port `8357` is a placeholder. HQ already tracks Qwen 3.5 on `:8355` and Qwen 3.6 on `:8356`. Use whatever port the 3.8 Unlocked container actually binds.

Do **not** reuse `LLM_PUBLIC_CHAT_URL` / `LLM_PUBLIC_CHAT_MODEL` (those are the public Qwen 3.6 chat on `llm.tolley.io`) unless you have confirmed that same process is now serving 3.8 Unlocked.

## Request shape

`POST /api/generate/chat` → Spark:

```http
POST {QWEN_VLLM_BASE_URL}/chat/completions
Content-Type: application/json
Authorization: Bearer {QWEN_VLLM_API_KEY}   # omitted when key is empty / "none"

{
  "model": "KarlKinda/Qwen3.8-27B-Uncensored-FP8",
  "messages": [
    { "role": "system", "content": "…" },
    { "role": "user", "content": "…" }
  ],
  "max_tokens": 2048,
  "temperature": 0.7,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

Expected response (OpenAI chat completions):

```json
{
  "model": "KarlKinda/Qwen3.8-27B-Uncensored-FP8",
  "choices": [{ "message": { "role": "assistant", "content": "{…json…}" } }],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 }
}
```

The director content is JSON: `{ "reply", "inference", "description" }`. `<think>…</think>` blocks are stripped.

## Safety

Unlocked means photoreal adult people, bikini, and identity-stills stay in Inference. The director prompt and a server-side check still refuse CSAM and real-minor content.

## Smoke test from the Spark box

```bash
curl -sS "$QWEN_VLLM_BASE_URL/chat/completions" \
  -H "Content-Type: application/json" \
  ${QWEN_VLLM_API_KEY:+-H "Authorization: Bearer $QWEN_VLLM_API_KEY"} \
  -d "{\"model\":\"$QWEN_VLLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":16}"
```

Then set the same three vars on the Vercel project and redeploy.
