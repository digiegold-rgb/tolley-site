# Heat ingest

Spark (the home server on the LAN) pushes furnace readings to tolley.io. The site never opens a connection back to the LAN.

`/heat` is a private phone dashboard. It is `noindex`, omitted from the sitemap, and not linked in the public nav. The PIN is `HEAT_PIN`, separate from the `/tv` shop PIN. The cookie is an httpOnly HMAC of that PIN (same shape as `/tv`, different secret and cookie name `heat_access`). `AUTH_SECRET` signs the cookie and must already be set.

## Environment

Set these in Vercel (Production, and Preview if you use it). Do not commit them.

| Variable | Purpose |
| --- | --- |
| `HEAT_PIN` | PIN that unlocks `/heat` |
| `HEAT_INGEST_TOKEN` | Bearer token for `POST /api/heat/ingest` |
| `AUTH_SECRET` | Already required. Signs the heat cookie |
| `DATABASE_URL` | Already required. Postgres stores the rows |

Optional: `HEAT_SAMPLE=1` shows built-in sample rows when the tables are empty or unreachable. Preview deployments do that automatically. Production does not.

Apply `prisma/migrations/20261118150000_heat_dashboard` before the first real push. It only creates `HeatSnapshot`, `HeatDay`, and `HeatReview`.

```bash
npx prisma migrate deploy
```

## `POST /api/heat/ingest`

```
Authorization: Bearer $HEAT_INGEST_TOKEN
Content-Type: application/json
```

Missing or wrong token: `401`. Invalid JSON or fields: `400`. Body over 1.5 MB: `413`. Storage down: `503`.

A body may be one snapshot, one daily row, one review, or a batch. Unknown extra keys are ignored. Repeating a timestamp or date upserts that row. In one batch, the last copy of a timestamp or date wins.

Limits per request: 500 snapshots, 400 daily rows, 90 reviews. A 90-day backfill of 5-minute snapshots is about 52 requests.

Snapshots older than 90 days, or more than 15 minutes in the future, are rejected. Each successful ingest deletes snapshots older than 90 days. Daily rows and reviews are kept.

`hvac` is `heat`, `fan`, or `off` (the dashboard shows off as Idle). `timestamp` is ISO-8601, or unix seconds/milliseconds. `date` is `YYYY-MM-DD` for the Chicago calendar day. The dashboard's "today" is `America/Chicago`.

Success:

```text
{ "ok": true, "snapshots": 1, "days": 0, "reviews": 0, "pruned": 0 }
```

### Snapshot (about every 5 minutes)

```json
{
  "timestamp": "2026-11-18T19:55:00Z",
  "kitchen_f": 71.2,
  "loft_f": 68.4,
  "kitchen_rh": 38,
  "loft_rh": 36,
  "outdoor_f": 34.0,
  "upstairs": { "setpoint": 70, "mode": "heat", "hvac": "heat", "fan_mode": "auto" },
  "downstairs": { "setpoint": 68, "mode": "heat", "hvac": "off" }
}
```

`kitchen_f`, `loft_f`, `kitchen_rh`, `loft_rh`, and `outdoor_f` may be null. Both zones are required. `fan_mode` is optional.

### Daily row

```json
{
  "date": "2026-11-17",
  "upstairs_heat_h": 4.2,
  "downstairs_heat_h": 2.5,
  "upstairs_cycles": 6,
  "downstairs_cycles": 4,
  "outdoor_low": 28,
  "outdoor_high": 46,
  "outdoor_avg": 36,
  "hdd65": 29,
  "est_therms_low": 1.8,
  "est_therms_high": 2.3,
  "est_cost_low": 2.4,
  "est_cost_high": 3.1,
  "ccf_per_hdd": 0.104
}
```

Heat hours and cycle counts are required. The estimate fields may be omitted. Upsert the same date through the day if you want "today's gas" to show Spark's own number; otherwise the page estimates dollars from today's heating time and the recent cost per heat-hour.

### Nightly review

```json
{
  "date": "2026-11-17",
  "text": "Upstairs ran through the evening. Loft stayed about two degrees under the kitchen."
}
```

`text` is markdown, up to 20,000 characters. The page renders the latest date.

### Batch

```json
{
  "snapshots": [
    {
      "timestamp": "2026-11-18T19:55:00Z",
      "kitchen_f": 71.2,
      "loft_f": 68.4,
      "kitchen_rh": 38,
      "loft_rh": 36,
      "outdoor_f": 34.0,
      "upstairs": { "setpoint": 70, "mode": "heat", "hvac": "heat", "fan_mode": "auto" },
      "downstairs": { "setpoint": 68, "mode": "heat", "hvac": "off" }
    }
  ],
  "days": [
    {
      "date": "2026-11-17",
      "upstairs_heat_h": 4.2,
      "downstairs_heat_h": 2.5,
      "upstairs_cycles": 6,
      "downstairs_cycles": 4,
      "outdoor_low": 28,
      "outdoor_high": 46,
      "outdoor_avg": 36,
      "hdd65": 29,
      "est_therms_low": 1.8,
      "est_therms_high": 2.3,
      "est_cost_low": 2.4,
      "est_cost_high": 3.1,
      "ccf_per_hdd": 0.104
    }
  ],
  "reviews": [
    {
      "date": "2026-11-17",
      "text": "Upstairs ran through the evening. Loft stayed about two degrees under the kitchen."
    }
  ]
}
```

`snapshot`, `daily`, `dailies`, and `review` are accepted aliases for the single-object and array forms.

### curl

```bash
curl -sS -X POST https://tolley.io/api/heat/ingest \
  -H "Authorization: Bearer $HEAT_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-11-18T19:55:00Z","kitchen_f":71.2,"loft_f":68.4,"kitchen_rh":38,"loft_rh":36,"outdoor_f":34,"upstairs":{"setpoint":70,"mode":"heat","hvac":"heat","fan_mode":"auto"},"downstairs":{"setpoint":68,"mode":"heat","hvac":"off"}}'
```

Use the current time in production. The timestamp above is only an example and is rejected once it is more than 90 days old.

## What the page does with the rows

- Live cards use the newest snapshot: kitchen, loft, outdoor, each furnace (`heat` / `fan` / `off`) and setpoint, plus how old the reading is.
- Today's gas uses that date's `est_cost_low` / `est_cost_high` when Spark has posted them. Otherwise it multiplies today's heat hours (from snapshots, gaps over 20 minutes do not count) by the recent cost per heat-hour.
- The 24-hour chart plots kitchen, loft, and outdoor, with a band while each furnace was heating.
- The daily chart stacks upstairs and downstairs heat hours, draws the gas estimate, and shows outdoor HDD.
- Week (Monday–today) and month totals sum the daily rows, plus today's in-progress estimate when that day has not been reported.
- CCF per degree-day is the recent average of `ccf_per_hdd` against a 0.11 baseline.
- The newest review is rendered as markdown.
