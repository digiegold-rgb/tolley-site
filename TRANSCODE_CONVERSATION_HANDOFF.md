# Transcode Handoff: T-Agent Conversation + Memory + Tasks

This website repo now expects the Tolley-Public agent to provide conversation-grade JSON and memory/task endpoints.

## Agent repo target
- `/home/transcode/.openclaw/workspace-tolley-public`

## Non-negotiable branding
- Never return `OpenClaw` in response text.
- Voice should be `T-Agent`: concise, confident, realtor-ops focused.

## `/ask` contract expected by website

`POST /ask`

Request body:
```json
{
  "question": "Show me homes in Olathe under 500k",
  "conversationId": "uuid",
  "intent": "optional",
  "userId": "optional"
}
```

Response body:
```json
{
  "answer": "human-readable response",
  "cards": [
    {
      "type": "listing",
      "address": "123 Main St, Olathe, KS",
      "price": 395000,
      "beds": 4,
      "baths": 3,
      "sqft": 2450,
      "summaryBullets": ["Updated kitchen", "Near parks"],
      "link": "https://...",
      "source": "db|mls|external"
    }
  ],
  "followUps": [
    "Expand to 10 results",
    "Change max price",
    "Only single-family",
    "Nearby cities"
  ],
  "memoryUpdates": [],
  "conversationId": "uuid",
  "requestId": "req_xxx",
  "cached": false,
  "latency": 1234
}
```

Rules:
- Listing search returns up to 5-10 cards (not just 1).
- `followUps[]` always present.
- If only one result exists, still include next best actions in `followUps[]`.

## Conversation context + memory endpoints

Implement:
- `POST /memory/get`
- `POST /memory/update`
- `POST /memory/forget`

### `POST /memory/get`
Request:
```json
{
  "userId": "user_123",
  "conversationId": "uuid"
}
```
Response:
```json
{
  "preferences": {
    "budgetMax": 500000,
    "beds": 3,
    "areas": ["Olathe", "Overland Park"],
    "verbosity": "concise"
  },
  "savedListings": [],
  "savedVendors": []
}
```

### `POST /memory/update`
Request:
```json
{
  "userId": "user_123",
  "conversationId": "uuid",
  "key": "savedListings",
  "value": {"address": "..."},
  "mode": "append"
}
```
Response:
```json
{ "ok": true }
```

### `POST /memory/forget`
Request:
```json
{
  "userId": "user_123",
  "conversationId": "uuid",
  "key": "savedListings",
  "index": 0,
  "clearSession": false
}
```
Response:
```json
{ "ok": true }
```

## Task scheduler endpoints (Milestone 5)

Implement:
- `POST /tasks/create`
- `GET /tasks/list`
- `POST /tasks/toggle`

Task shape:
- `id`
- `userId` and/or `conversationId`
- `title`
- `schedule` (cron or normalized natural schedule)
- `prompt`
- `enabled`

Runtime:
- Use `node-cron` (or BullMQ if Redis available).
- On execution, post task output back into conversation history tied to `conversationId`.

## Suggested implementation order on Transcode
1. `/ask` JSON contract + brand cleanup + multi-listing cards
2. Conversation context state keyed by `conversationId`
3. Memory endpoints
4. Task table + task endpoints + cron runner
5. Persona consistency + verbosity preference enforcement

## Quick validation commands on Transcode
```bash
curl -s http://localhost:3002/health
curl -s -X POST http://localhost:3002/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Find homes in Olathe under 500k","conversationId":"test-conv-1"}'
curl -s -X POST http://localhost:3002/memory/get \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","conversationId":"test-conv-1"}'
```
