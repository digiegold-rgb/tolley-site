# OpenClaw Connector (VPS/Tailnet)

This service is the bridge connector for serverless web backends (e.g., Vercel):

`tolley.io/api/admin/openclaw/*` -> `connector` -> `bridge (100.x)` -> `gateway (127.0.0.1:18789)`

## Security Contract

Inbound website -> connector:

- `X-Bridge-Timestamp` (unix seconds)
- `X-Bridge-Nonce` (uuid)
- `X-Bridge-Signature`
- Signature input:
  - `timestamp + "." + nonce + "." + method + "." + path + "." + sha256(body)`

Checks enforced:

- timestamp skew <= 60 seconds (configurable)
- nonce replay blocked for 5 minutes (in-memory cache)
- signature verification with timing-safe compare

Outbound connector -> bridge:

- Same signature contract with separate shared secret.

## Audit

Mutating operations (`POST/PUT/PATCH/DELETE`) are logged to:

- `~/.openclaw/audit/admin-actions.jsonl`

Fields include:

- timestamp
- admin email (from `X-Admin-Email`)
- action/path
- target hints (`agentId`, `bindingId` when inferable)
- payload hash summary
- response status + duration

## Environment Variables

- `CONNECTOR_HOST` (recommended: tailscale IP `100.x.x.x`)
- `CONNECTOR_PORT` (default: `8787`)
- `BRIDGE_BASE_URL` (e.g., `http://100.64.0.25:3000`)
- `WEBSITE_TO_CONNECTOR_SECRET` (shared with website backend)
- `CONNECTOR_TO_BRIDGE_SECRET` (shared with bridge)
- `BRIDGE_MAX_SKEW_SECONDS` (default `60`)
- `BRIDGE_NONCE_TTL_MS` (default `300000`)
- `OPENCLAW_AUDIT_PATH` (optional audit file override)

## Run

```bash
node connector/server.js
```

Health endpoint:

- `GET /connector/health`
