# Crazy Monkey: Spark HVAC planner

Source for `~/heatctl`, installed November 23, 2026. The November 23 **review and
implementation guide** takes precedence over the older handoff where targets,
setpoint bounds and control priorities differ. Runtime data and credentials are
not committed. Jared subsequently authorized **live learning**, waiving only the
five-day waiting period. See [current operations](OPERATIONS.md) and the runtime
`cutover.json` / `commissioning-result.json` for actual deployment evidence.

## Goal and current ownership

Reach the living-room comfort target by wake time with economical, forecast-led
heat, using the kitchen/couch sensor as the comfort signal. Nest is supplemental,
not the room-temperature reference. Prefer gentle recovery but never claim stage
1/2 is measured or controlled: the supplied staging documents conflict.

Shadow uses `~/humid/state.json` and `~/sensors/latest.json`. It makes **no TCC or
SDM calls** and never reads a thermostat credential. Open-Meteo is cached locally.
While shadow, existing `humid.service` is the cloud poller; `fanctl` remains paused.
In live operation both legacy services are disabled and heatctl owns the poller.
`loftfan.service` remains the sole Airius writer at .44. No legacy plug .13–.16
is read or modified by this controller.

Prepared live architecture: `heatctl` acquires the existing `humid.lock` and uses
the existing persistent Honeywell session/collector through `io_live.py`; stop
`humid.service` and `fanctl.service` at cutover. It preserves the legacy telemetry
and CSV formats used by heatpush and furnace-rollup. Nest token refresh then has
one owner on Spark, conditional on stopping the cloud copy. Loftfan stays delegated.
Hardware identity is pinned in the manifest. Supervised commissioning verifies
real fan AUTO and relay OFF and sends the Nest's existing target with readback;
this is not a forced heat-cycle or morning-comfort acceptance test.

## Provisional shadow settings

7 AM wake both weekdays/weekends; 69F normal / 70F raw-day room target. Raw includes
below 40F, wind 12 mph, gusts 25 mph, rain, overcast, or feels-like 6F below actual.
Evening +1F begins 30 minutes before the configured 16:00 sun-off. These settings
remain owner-review items before live operation. Cooling records are supported,
but cooling control is deliberately blocked pending equipment commissioning.

Nest supplement 78F (hard max 80); idle 70; nighttime OFF. Honeywell bounds 50–73;
night setback 58, or 60 with forecast low below 15. No warm-up before 03:00.
Lead time uses projected night cooling, furnace-combination/outdoor-band learning,
15-minute buffer and an additional cold feels-like buffer. Daytime projections
assume daytime comfort maintenance; they do not assume cooling all afternoon.
Initial seeds are explicitly provisional: both furnaces 2.1F/h, Nest-only 0F/h.

External raises are preserved through the current period; actor is unknown.
Initial high setpoints are preserved until a boundary rather than silently reset.
Humidifiers use fresh Honeywell `fan_running` status (90-second maximum age),
with the original observation timestamp and successful poll requirement.
The Shelly at .151 is the separate **Fireplace Blower**, not a furnace meter.
Missing/stale/stopped blower status or missing RH fails OFF; room-temperature,
RH and seasonal limits remain. Fan mode ON alone does not prove airflow.

A local asynchronous humidity loop checks every ten seconds independently of
slow thermostat calls. Only the pinned humidifier relay at .36 receives humidity
writes. Every ON requires a verified 30-second hardware shutoff lease. Cloud
observation latency limits stop detection; the lease bounds operation after
renewals stop, not time since the physical blower stopped.

`heatctl-blower.service` is disabled and its power logger retired. No furnace
power meter is commissioned. Historical .151 logs/calibration/events and earlier
power-derived runtime totals belong to the fireplace and must not be interpreted
as furnace measurements. Current daily reports remove these erroneous furnace
metrics and label the start of corrected Honeywell blower-only coverage.

Stove `--fan-hold` still requests upstairs blower ON for up to eight hours;
normal stove mode leaves fan AUTO. Humidification no longer requires stove mode.

## Commands

- `heatctl dry`: one real-data proposal; no device commands or control-state writes.
  It can refresh the weather cache. No extra thermostat login/token refresh.
- `heatctl status`, `heatctl model`, `heatctl acceptance`.
- `heatctl warm 71 2h`, `heatctl hold 70 4h`: bounded, expiring room targets.
- `heatctl auto`, `heatctl away`, `heatctl home`, `heatctl stove 2h`.
- `heatctl stove 2h --fan-hold`: hold upstairs blower ON; `heatctl stove 0`
  cancels. Expiry requests AUTO. Away and room-temperature safety override the
  fan hold. Thermostat freshness, retry backoff and write caps still apply;
  requested transitions can be delayed by these checks or cloud failures.
- `heatctl nest-fan on 2h`, `heatctl nest-fan off`: bounded Nest fan timer
  (up to twelve hours), using Google's Fan.SetTimer command and deadline
  readback. Nest airflow does not satisfy the upstairs humidifier interlock.
  The timer expires on the device even if heatctl stops.
- `heatctl mode shadow`: stop live planning and restart in shadow. This alone does
  not restart legacy services or restore cloud routines; follow rollback below.

Commands are UUID-keyed and expire if not consumed in ten minutes. In shadow they
only modify proposals. Browser controls use the existing Heat PIN, same-origin
checks and rate limits. They cannot enable live or exceed target/duration limits.
These new fan options are CLI commands. While heatctl is paused they only queue;
they do not start the service or change equipment immediately.

`HONEYWELL_WRITE_FAILURE_2` is recorded at the second consecutive failed actual
send/readback, including retries. It appears in decision alerts until a fresh
successful readback/poll confirms the desired state. Pre-send read failures and
write-cap blocks do not count as failed sends. The threshold event is durable even
if a later retry succeeds. Events use the existing log/upload/dashboard path;
this does not add an SMS or email destination. Existing 30-minute fallback and
write limits remain in force.

`accepted_live` means consumed by the planner, **not** successful equipment action;
actual write attempts and readbacks are separate events.

## Persistence and website

`events.sqlite` is authoritative, with synchronous commits and an acknowledged
outbox. Every decision, learned update, watchdog observation and write outcome is
exported into daily `logs/YYYY-MM-DD.jsonl`. Export recovery can duplicate UUIDs
after a crash, never discard a database event. Server ingestion is idempotent.
Only explicit `event_ids` acknowledgments remove pending events. Failed uploads
retry every two minutes, retaining all data. No credentials enter the events.

`model.json`, `state.json`, `reports/YYYY-MM-DD.json`, `upload-status.json` and
`watchdog-state.json` provide local inspection. Measured rates only update over
continuous, same-condition windows with genuinely new temperature readings.
Warm-up rates are keyed by actual furnace combination and outdoor band; cooling
by blower state and outdoor band; humidity by actual operating condition.

The private `/heat` panel includes proposed/actual distinctions, before/after
timeline and filters, forecast, model history, morning comparison, partial-window
costs, commands and independent watchdog state. Original snapshot/daily/review
ingestion remains compatible. Additive migration:
`prisma/migrations/20261123190000_heat_planner/migration.sql`.

Events retain two years server-side. A 60-second tick produces about **1,440
decisions/day**, more than the guide's 100–300 estimate. Additional writes/learning
are extra. JSONL remains local history; unacknowledged events are never pruned.
There are no measured gas/stage/water prices: gas is bounded input-rating × runtime,
humidifier electricity/water are nameplate estimates, water cost stays null.
Partial observation coverage is labeled and does not replace full-day old totals.

`heatctl-review.timer` runs at 23:25 Central. Shadow reviews go to
`~/heatctl/reviews/` and the planner panel, preserving Glow's original nightly
review. Keep cloud reviews as read-only reporting after cutover.

## Live gate and cutover

`heatctl acceptance` measures five elapsed days, five days with >=1,000 usable
observations, and three cold mornings with >=120 valid samples between 03–07.
These are minimum review gates, not proof of comfort or savings. Shadow cannot
prove a setpoint write's readback success. Two-week live comfort acceptance and
seven-day cloud-write reliability remain pending until actual operation.

The owner explicitly waived this waiting period on November 23. A separate
`shadow_wait_waiver` records the original instruction, approval and timestamp.
It does not claim the shadow acceptance passed and cannot waive the remaining
ownership, device-identity, commissioning or airflow-review checks.

Before cutover, record the owner's explicit **go** and confirmed schedule/targets,
loft overnight policy, humidifier airflow/interlock review, and verified device
identities in `~/heatctl/cutover.json`. Required flags are checked by code:
`owner_go`, `cloud_control_jobs_paused`, `cloud_nest_refresh_stopped`,
`comfort_settings_confirmed`, `commissioning: "passed"`,
`airflow_interlocks_reviewed`, plus `humidifier_device_id` and `nest_device_name`.
Do not write true flags without their corresponding verified evidence.

The owner confirmed the five Glow controls/watch routines are paused, tomorrow's
re-enable job is deleted, no independent Nest refresher remains, and retained
nightly/weekly reporting does not command thermostats. This confirmation is
recorded with the cutover; no claim of direct access to Grok's scheduler is made.

1. On Glow, pause morning-warm-up, night-setback, downstairs-heat-off,
   cold-day-comfort-check and adaptive-heat-watch-only. Stop the box Nest refresher.
   This API session has no access to Glow's routine manager; those actions need
   the owner/Glow, not a fabricated local acknowledgment.
2. Recheck both thermostats, sensors, active holds and manual controls. Back up
   config/state and record current modes. No purchases, wiring or device schedule
   programming are included.
3. Stop `humid.service` and `fanctl.service`; verify both inactive. Configure
   heatctl mode live and restart only after all gates and identities pass.
4. Verify Honeywell AUTO and each command's delayed readback. Confirm downstream
   telemetry, CSV rollup and site uploads. Observe errors and manual holds.
5. Keep the independent watchdog. Its live fallback obtains the same process and
   humid locks before any cloud session; with an active owner it queues a safe
   request. If cloud/network is unavailable it logs failure, not a fake safe state.

No software can guarantee a cloud command lands during an outage. The Honeywell's
on-device backstop schedule requires separate owner approval and is not changed.

Rollback: `heatctl mode shadow`, then restore/start the backed-up legacy humid and
fan configuration and resume the five cloud routines via Glow. Check fan AUTO and
relay behavior explicitly; do not simply remove the old pause file and assume
safety. Cloud jobs cannot be paused/resumed by a pretend Spark one-liner.

## Acceptance record

| Guide step | Current implementation / acceptance |
|---|---|
| 0 architecture | Modular planner, config, dry CLI and shadow service implemented; tests pass. |
| 1 shared I/O | Live heatctl is the single local owner; legacy writers disabled and remote retirement owner-confirmed. Seven-day reliability pending. |
| 2 writes | Read-before-write, readback, timeout reconciliation, retries, bounds and hourly cap tested. Fan AUTO and Nest same-target command path verified live; long-term write statistics pending. |
| 3 learning | Per-condition observed learning, counts and history implemented; multi-day calibration pending. |
| 4 morning | Forecast/recovery calculation and cold-morning fixture pass; three observed mornings and two-week comfort outcome pending. |
| 5 Nest | Supplemental high/idle/night rules and satisfaction metrics implemented; actual comfort delivery must be observed. |
| 6 escalation | Pre-7 AM L3 fixture passes; 10-minute/3-per-hour caps and >5F dual-change restriction prepared. Savings/comfort improvement unproven. |
| 7 periods | Day/raw/evening/setback implemented; first live 22:00 outcome pending. |
| 8 humidity | Power interlock and 30-second relay lease installed Nov 26; live takeover remains paused. Physical interlocks unverified. |
| 9 overrides | Expiring CLI/site requests and external-raise holds implemented; observed holds preserved at cutover. |
| 10 watchdog | Independent unit, durable alerts, single-owner live fallback enabled. No forced live safety-temperature test. |
| 11 rollout | Owner-approved live learning replaces shadow wait. Actual shadow acceptance remains incomplete; remote pause is owner-confirmed. |
| 12 hardware | Not commissioned or purchased. Stage always labeled unknown. |

Tests: `python3 -m unittest -v test_heatctl.py` here; website schema tests in
`lib/heat/planner.test.ts`; authenticated integration/browser test in
`tests/heat-planner-integration.mjs` (local test DB only).

## Manual controls and uninterrupted reporting (November 26 correction)

Keep the controller running during normal manual operation. Use
`heatctl manual upstairs-fan` (or `upstairs-temperature`,
`downstairs-temperature`, `downstairs-fan`, `humidifier`) before an external
manual writer starts, then `heatctl auto upstairs-fan` after that writer finishes.
An optional duration such as `2h` releases a claim automatically; omitted duration
requires explicit scoped release. `heatctl owners` shows explicit claims.
Unscoped `auto` clears inferred planner holds, not external ownership claims.

A component claim suppresses only that component's fields. A manual fan setting
leaves both thermostat temperature controls, learning, and uploads running.
Fresh external thermostat changes in either direction are preserved to the next
schedule period; external fan ON persists until AUTO/OFF or timer expiry.
Humidifier-only holds suppress ON, with airflow/RH/safety OFF still enforced.
The Fireplace Blower has its own nightly OFF action. Airius has its separate owner.

If the main service is deliberately stopped for maintenance, the independent
`heatctl-telemetry.service` collects read-only observations and uploads them. It
uses shared locks and yields to the main controller, so there is one cloud poller
at a time. Its durable upload status is `telemetry-events/upload-status.json`.
It never starts automatic controls or consumes queued commands. The dashboard
labels these observations REPORTING_ONLY / shadow. See OPERATIONS.md for current
manual ownership and actual deployment evidence, rather than old pause notes.

## Nightly stove/fire cutoff

The owner's nightly **1:00 AM America/Chicago** rule supersedes indefinite
upstairs-fan/humidifier holds. Their claims expire at the next 1 AM; other manual
components are unaffected. Stove requests cannot extend beyond that boundary.
At cutoff, the controller requests Honeywell fan AUTO and restores automatic
blower-based humidification with all existing airflow/RH/lease safety checks.
No fire-out inference is used. AUTO allows normal furnace heat/purge blower runs.

`heatctl-fire-cutoff.timer` is persistent and wakes the same controller; calendar
catch-up also runs after restarts. Honeywell writes stay with the controller.
The timer also sends identity-pinned `Switch.Set {"id":0,"on":false}` to the
Fireplace Blower at .151 and verifies OFF. Controller catch-up retries failures
at most once per minute; a shared lock and durable completion prevent duplicate
actions for the same cutoff. See `fireplace-cutoff-status.json`. The first
fireplace action is November 28, 2026, 01:00 CST.
Inspect `fire-policy.json`, `fire-cutoff-request.json`, `fire-cutoff-status.json`,
and normal decision/upload logs. Fan AUTO is only marked complete after fresh
readback. Honeywell outages, ongoing reads, and existing write caps/backoff can
delay physical switching; pending cutoff alerts remain visible. The humidifier's
ownership expires independently of those cloud calls.
