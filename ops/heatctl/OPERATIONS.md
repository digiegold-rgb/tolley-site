# Heat operations and owner feedback

## November 27 device correction — current and authoritative

Owner clarified: **192.168.2.151 is the independent Fireplace Blower**, renamed
"Fireplace Blower", NOT the furnace. Read-only identity check confirmed
`shellyplugusg4-98c37700c550`. This supersedes every earlier identification of
.151 as Furnace and the associated prohibition against its authorized OFF command.
Do not infer furnace airflow, furnace runtime or furnace electricity from .151.
The owner's exact instruction is saved in feedback.jsonl, id
`f5fe42b0-f1be-4bd7-b836-abe3f3651676`.

The existing 1 AM America/Chicago cutoff now also sends `Switch.Set` with
`{"id":0,"on":false}` to .151, without toggle_after, after checking its device ID,
then verifies Switch.GetStatus output=false. First fireplace cutoff is
**November 28, 2026 at 01:00 CST**; installation does not switch it immediately.
`fireplace.py` is called by both the timer request and controller catch-up, with a
shared file lock, durable per-cutoff completion and a 60-second failed-attempt
retry interval. Successful cutoffs are not reapplied throughout the day, allowing
subsequent manual use. Status is `fireplace-cutoff-status.json`; failed controller
attempts emit FIREPLACE_CUTOFF_PENDING. Honeywell AUTO and humidifier ownership
expiry remain independent. Live-mode gating remains in effect.

`blower.py` now reads actual Honeywell `fan_running` telemetry, preserving the
original observation timestamp, with a strict 90-second freshness bound and
successful Honeywell poll requirement. It performs no Shelly calls and returns
no watts. Unknown, stale, failed or stopped blower status prevents humidifier ON.
The 10-second humidity loop, .36 identity pin, RH/room limits and 30-second relay
lease remain. Cloud observation latency now limits stop detection; do not claim
the former power-sensor 30-second stop-to-OFF guarantee. Fan mode ON alone and
Nest fan status do not establish upstairs airflow.

`heatctl-blower.service` is stopped and disabled; its old logger entry point is
retired to prevent accidental restart. Observations ignore the historical meter
cache. Current daily reports discard erroneous furnace power/runtime totals and
restart blower-only coverage from this correction, labeled by source and time.
Historical .151 power logs, calibration, uploaded power events and earlier daily
totals are retained as historical evidence but describe the fireplace, not the
furnace; do not use them for furnace calibration or savings claims.
Backups: `backups/fireplace-identity-20261127-082517/`.

## November 24 morning comfort correction

Humidity follow-up at 08:38 CST: owner asked why two 4500-sq-ft Honeywell units
had not reached 50% RH (exact feedback saved). Through 08:37, decision telemetry
showed about 135.5 minutes of shared relay ON since midnight; from 07:36–08:37,
about 49 of 60 observed minutes were ON. Room rose from 65.3F/33.8% to
67.64F/35.2%. Some refreshed-airflow/readback errors caused brief OFF periods;
do not bypass these checks. Relay ON does not prove either unit's fan, water
flow, pad wetting or moisture output; no power/water meter is present.

Installation needs owner/technician confirmation: records say HE360A1075 units
on upstairs return with an inline manual humidistat. Honeywell specifies warm
supply mounting and says return mounting greatly reduces efficiency:
https://www.honeywellhome.com/blogs/support/where-should-i-install-my-he360-powered-flow-through-humidifier
Manufacturer manual 69-2631ES-13 lists 35% at 20F outdoors and 40% above 20F;
current inherited 50% target at about 26F exceeds that guidance. Flag this for
review rather than claiming 50% is a validated building-safe target. Asked owner
to confirm mounting and manual dial setting; no setting/wiring changes made.
Manual: https://customer.resideo.com/resources/techlit/TechLitDocuments/69-0000s/69-2631ES.pdf

Owner follow-up saved 08:57 CST: manual dial is 50+, both units run on the relay,
and both have substantial water coming out. Treat these as owner-confirmed;
do not keep asking whether water is flowing or assume a 35% dial cutoff.
08:56 telemetry: living 68.36F/35.4%, loft 69.62F/34.6%, outside 27.3F;
upstairs heating/blower running, relay ON with verified readback, RH target 50.
Since the 07:36 repair the living room warmed about 3.1F while RH rose 1.6 points.
Drain flow is not measured evaporation. Hot/cold feed and even pad wetting remain
unverified. No additional equipment or control change made from this feedback.

09:21 owner instruction: "everytime the heat is on the humdidy needs to be on"
(also saved with observations in feedback.jsonl). Verified the existing planner
requests humidification during observed heating with fresh upstairs blower
running and RH below the limit, including night/setback periods. No new toggle
was needed. Pure checks passed for night, warmup, day, evening and setback;
missing-airflow and RH-limit checks still block ON. At 09:21 both furnaces called
heat and humidifier ON readback passed; living RH 36.0%, loft 35.5%.
Intermittent refresh/actuation failures are still recorded and can interrupt ON;
do not claim uninterrupted physical operation. Downstairs-only heating does not
establish airflow through the upstairs humidifiers. Preserve airflow interlocks.

Owner feedback at 07:34 CST requested the living room at 71F by 07:00 and
reported being very cold. Exact words and pre-change observations are saved in
`feedback.jsonl`. The room was 65.3F, RH 33.8%, outside about 23F. Honeywell was
at 66F with no heat call/blower, while Nest was heating at its 78F supplement.
Uploads were healthy; humid/fanctl remained inactive and disabled, loftfan active.
Glow's cloud routine manager is unavailable in this session, so its current pause
state could not be independently checked; the November 23 owner confirmation
remains the last evidence, not a new verification.

Set weekday/weekend wake targets to 71F at 07:00, daytime targets to 71F to
avoid dropping the target at wake, and warmup buffer to 30 minutes plus the
existing 15-minute cold-weather buffer. Forecast/learning still select the start,
with the existing 03:00 earliest-start limit and all equipment bounds unchanged.
Honeywell temporary hold deadlines must fall on 15-minute boundaries. The adapter
previously used arbitrary minutes, causing local SomeComfortError failures and
consuming the attempt budget. The adapter now rounds deadlines upward; regression
coverage exercises all minutes including midnight using the installed client's
validator. Do not clear write caps to force retries. A commanded target is not
proof of room comfort; verify actual furnace calls and tomorrow's 07:00 reading.
Pre-change files: `backups/morning-71-20261124-073536/`.
Live verification: at 07:36:12 Honeywell accepted 73F with successful readback;
at 07:36:37 fresh telemetry confirmed heat calling and blower running, fan AUTO.
Nest also called heat. Humidifier lease/readback passed with confirmed airflow.
Failure alert cleared; upload at 07:36:38 succeeded with zero pending events.
All 40 controller tests passed. Living room was still 65.3F at this immediate
verification; recovery and tomorrow's wake comfort remain to be measured.

Jared authorized live learning on November 23, 2026: "make it live ill give you
feed back just look for me to start the convo off with -heat". This explicitly
waives the five-day shadow wait, not device limits or single-controller ownership.
Current state and verified commissioning results are in `~/heatctl/`; read them
before claiming the system is live. The owner confirmed Glow paused all five
control/watch routines, deleted the scheduled re-enable job, and has no separate
Nest refresher. Its nightly and weekly reports remain read-only for thermostats.

## Begin a `-heat` conversation

Read `heatctl status`, `~/heatctl/upload-status.json`, recent
`journalctl --user -u heatctl.service`, and `~/heatctl/feedback.jsonl` if present.
Use the current living-room measurement, target, forecast, furnace calls,
setpoints, fan state, humidity and recent decisions to interpret the feedback.
Save the owner's exact feedback via `~/humid/.venv/bin/python
~/heatctl/feedback.py 'feedback text'`, using proper shell quoting or a structured
Python call. The record contains the corresponding observation snapshot.
Writing feedback never changes hardware. Diagnose the relevant time window;
do not silently treat a retrospective complaint as a current temperature command.
Apply requested comfort adjustments within existing bounds and verify outcomes.
Thermal rates learn automatically; conversational feedback is interpreted by the
assistant, not automatically parsed by the controller into new safety limits.

## Live ownership and checks

`heatctl.service` polls and controls Honeywell, the pinned Nest and the humidifier
relay. `humid.service` and `fanctl.service` must be stopped and disabled while live.
`loftfan.service` independently owns the Airius fan (.44): ON gap >=3F, OFF <=1.5F.
Never confuse it with the old `loft` helper's .13 plug or the furnace blower.

`~/heatctl/cutover.json` records the owner's waiting-period waiver, cloud-job
confirmation, device identities, installation-review limitations and backup path.
`commissioning-result.json` records actual fan AUTO/relay OFF verification and
the Nest command path at its existing target (not a forced heat-cycle test).
Physical airflow interlocks were not independently verified or rewired. Since November 26, live software uses the read-only Furnace power sensor
before relay ON and a verified 30-second lease. Any blower cause qualifies
below the RH cap. The earlier cloud-airflow/600-second policy below is historical.

Learning continues from actual measurements in either mode. Seeded rates remain
labeled; successful command readback is not proof of morning comfort. Review the
first setback and morning recovery from persisted decisions and owner feedback.
Manual raised targets remain through the current period; a deliberate `heatctl
auto` clears holds. Controls and decisions are at the private tolley.io/heat page.

## Rollback

`heatctl mode shadow` stops automatic equipment writes but does not set safe
equipment states or resume cloud routines. Verify humidifier OFF and fan AUTO
first when possible. Re-enable legacy services only after heatctl has relinquished
their lock, using the saved configuration and reviewing its old fan-only humidity
policy. Glow routines need a separate explicit resumption; never assume they
restart because Spark changed modes. Preserve the outbox, learning and feedback.


## November 24 evening humidity and cost feedback

At 20:32 CST owner reported 30% RH uncomfortable, intentionally keeping the home
warm while away with uncertain return time, and requested nightly cost visibility
and future fire/wood savings comparison. Exact words and contemporaneous snapshot
saved via feedback.py, id c59278bc-98e8-48c3-ae09-f2843235fe46. No equipment or
schedule changes were requested/applied in this diagnostic follow-up.

20:32 daily_model delivery was acknowledged: gas estimate $9.14–$12.17,
upstairs heat 7.10h, Nest heat 4.34h, humidifier relay 5.48h and estimated
humidifier electricity $0.12. These are runtime/nameplate estimates, not metered
utility spending; water rate is unset and furnace blower electricity is absent.
Daily summaries emit every 300 seconds, uploads every >=120 seconds. Active
heatctl-review.timer next run verified at 23:25 CST Nov 24; that review is not a
midnight-complete day. Living room 71.06F/31.5% RH, loft 69.98F/33%, outdoors
30.3F. Morning living RH peaked 36.0%, then fell; not a fixed 30% software cap.

Decision integration through 20:32 found about 66 minutes of observed upstairs
heat with humidifier ON requested but ON readback unsuccessful (about 58 minutes
RuntimeError, 8 TimeoutError). This is unverified ON time, not proof of equivalent
physical downtime. Detailed failure causes are not retained in these events.
Software preserves refreshed upstairs airflow, identity, lease and readback checks.
Recorded return mounting remains unconfirmed by owner; Honeywell's HE360 manual
and support specify warm supply mounting and warn return mounting reduces output.
Earlier owner confirmations of dial 50+ and substantial drain flow still apply.
Need to verify placement, pad wetting/distribution and unit fan performance;
drain flow does not measure water evaporated into the house.

Current gas model implies each displaced upstairs burner-hour saves about
$1.00–$1.42 and each displaced Nest burner-hour about $0.47, before wood/other
costs. Four hours with BOTH burners otherwise continuously on would represent
about $5.88–$7.59 gas, not an automatic credit for a four-hour fire. Wood cost and
fire start/end times needed; compare weather/temperature-matched periods before
claiming realized savings. Asked owner wood price and supply/return placement.
Legacy humid/fanctl verified inactive+disabled; loftfan independently active.
No Glow cloud routine management tool available; current cloud pause state could
not be independently reverified (last evidence remains owner confirmation).


## November 26 fire-day fan control repair (heatctl remains paused)

Owner's exact request recorded via feedback.py at 09:48:11 CST, id
27503f56-dec0-4f39-9424-9be1f0ccf6ee. Owner reported stove-mode humidification
blocked by fan AUTO, 28–31% RH against 50%, Shelly Gen4 rejecting OFF with
`toggle_after=0`, frequent Honeywell failures, and Glow's manual takeover.
Journal confirms heatctl stopped at 09:46:32 CST. The watchdog timer is also
inactive; both remain paused. humid.service and fanctl.service remain inactive
and disabled. Do not restart heatctl/watchdog during Glow's manual ownership.
The owner says Glow will resume after the fire. This session cannot independently
inspect Glow's cloud routine scheduler; no cloud pause/resume changes made.

Last controller decision at 09:46:02: living 71.6F/31.7%, loft 75.92F/28.6%,
outdoors 34.2F; upstairs fan AUTO/not running, both furnaces not calling, relay
OFF. At 09:51 local sensors read living 71.78F/31.5%, loft 76.64F/28.0%;
thermostat observations were stale due to the pause and are not current manual
fan readbacks. Last upload success 09:44:03; database has 3 pending events,
expected to drain after resumption. Feedback snapshot retains its decision time.
November 25 JSONL has 31 failed Honeywell write_attempt events (24 RuntimeError,
7 TimeoutError) and 23 successful attempts. This confirms the 31 failures but
not the owner's denominator of 72; stored errors do not identify the full cause.

Installed changes:
- `heatctl stove 2h --fan-hold` requests upstairs fan ON for the explicit stove
  interval (0–8h); `heatctl stove 0` cancels; plain stove preserves AUTO behavior.
  Expiry requests AUTO. Fan hold permits humidity only with actual fresh upstairs
  airflow, RH limits and the existing 600-second verified relay lease. Away,
  room-temperature safety and watchdog recovery override the hold. Honeywell
  AUTO restoration requires the controller running and a successful cloud write;
  existing write caps/backoff can delay transitions. No caps were reset/bypassed.
- `heatctl nest-fan on 2h` / `heatctl nest-fan off` use the pinned Nest's Fan.SetTimer
  capability, deadline readback, and native expiry (up to 12h). It cannot establish
  airflow for the upstairs humidifiers. API contract checked against
  https://developers.google.com/nest/device-access/traits/device/fan .
- `HONEYWELL_WRITE_FAILURE_2` emits a durable threshold alert at two consecutive
  failed actual sends/readbacks, including retries, and remains in decisions
  until a fresh matching poll/readback. Pre-send failures/cap blocks do not inflate
  that counter. Existing log/outbox/dashboard delivery; no new email/SMS channel.
- loftfan normal OFF and failed-lease cleanup OFF both omit toggle_after. ON
  retains its verified 180-second lease. Restarted only loftfan at 09:51:09;
  active PID 75949 and a fresh successful leased ON observation verified.

Validation: 48 heatctl tests, 19 loftfan tests, isolated CLI queue checks passed.
No thermostat/humidifier command was issued or queued against the real system.
Fan hold/Nest actuation and a live loftfan OFF transition remain to be observed;
we did not interrupt the fire-day circulation for a live OFF test. Heatctl and
watchdog changes take effect when Glow resumes them after relinquishing manual
control; queued commands expire after ten minutes while paused. Current existing
stove state was not changed to enable fan hold retroactively.
Backups: ~/heatctl/backups/fire-day-20261126-094839/.


## November 26 Furnace power sensor — read-only hardware rule

The owner explicitly authorized replacing Honeywell cloud fan_running with the
new Furnace Shelly Plug US Gen4 power measurement, allowing humidity for any
blower cause, and approximately 30-second shutoff after blower stop. Exact request
and starter code saved via feedback.py at 09:58:54 CST, id
e24f35c9-0fe6-451d-8c0a-35f46bfa1358.

**NEVER switch or configure the Furnace plug at 192.168.2.151. It powers the
furnace itself. READ ONLY.** Identity checked by GET: Furnace,
shellyplugusg4-98c37700c550, S4PL-00116US, Gen4. Owner reports restore-on set.
No Switch.Set, Switch.Toggle, configuration, reboot or counter-reset request may
be sent there. The adapter allows only Shelly.GetDeviceInfo and Switch.GetStatus
GETs, with a three-second request timeout. Humidifier writes are separately
pinned to http://192.168.2.36 plus its commissioned device identity.

Owner's 09:56 fan-only observation: 25.8 W, retained separately in
blower-owner-observations.jsonl. Direct GET confirmed 25.8 W at intake; initial
logging around 10:00–10:05 saw 25.5–25.6 W. These are whole-furnace watts. Idle
and heat-fire/startup/shutdown states have not yet been independently observed.
15 W ON / 10 W OFF hysteresis is provisional as requested; inducer, igniter and
controls may draw power without the main blower. Do not claim physical airflow
or calibrated discrimination from these readings alone. Log natural cycles;
do not shut off furnace supply or force a heat cycle just to calibrate.

heatctl-blower.service is an independent read-only logger, enabled and running
while heatctl and its watchdog timer remain paused for Glow's manual ownership.
It polls every ten seconds, records raw JSONL, maintains daily observed/runtime
and integrated furnace-electricity totals, and maintains calibration summaries
by idle_candidate / heat_call / fan_only / unclassified. Stale cloud status must
not be used to label a sample as a confirmed heat/fire state. Its own durable
outbox is blower-events/ (separate from the planner); uploading requires the
new blower_sample server schema. No real equipment commands were sent in this
installation session. Legacy humid/fanctl writers must remain inactive.

On heatctl resumption: a serialized asynchronous humidity loop runs every ten
seconds alongside thermostat planning, without waiting for slow cloud calls.
Any fresh valid power-inferred blower state permits humidification below the RH
cap (with RH hysteresis), regardless of heat, fan switch, stove mode, away, or
manual circulation. Unknown power/RH fails OFF; room temperature safety and heat
season bounds remain. The humidifier's verified hardware lease is now **30 s**,
replacing 600 s. Network/process failure stops renewals; normal power-loss
handling sends OFF on the next fast check. All OFF requests omit toggle_after.
Honeywell/Nest read failures are not an airflow interlock. The main actuator
reports fast-loop results and cannot issue a competing humidity ON lease.

The power logger does not run the humidity loop, start heatctl, or interfere
with Glow's manual control. Do not start heatctl/watchdog until Glow relinquishes
manual control. Live power-to-humidifier transitions and real 30-second lease
acceptance are still to be observed after that handoff. Backups:
~/heatctl/backups/blower-power-20261126-095854/.


Power rollout validation: 56 Python tests passed, including read-only endpoint
allowlisting, pin/identity rejection, power hysteresis, invalid/unknown readings,
independent fast-loop scheduling, runtime gaps/day boundary, and forced humidifier
OFF on missing lease. Site: 20 heat/schema tests and TypeScript check passed;
authenticated local mobile (390px) and desktop (1440px) browser checks passed
with a real local power sample injected into the preview, no overflow/page errors.
Site PR #280 merged as 9e80abc11aff149e2093bc5e0c98daca695b9d4e (v1.73).
Production deployment is being verified before enabling the logger uploader.
The Vercel preview check was skipped by the configured ignored-build step; do not
mistake that check for a successful preview build. Local type/browser checks ran.


Production verified at 10:19:36 CST: https://www.tolley.io/heat is v1.73,
deployment dpl_2Q6Gq14mPjC1uQUigACuSoddYpq1 Ready. The full production build
passed. Enabled uploader at 10:19; first batch acknowledged all 16 events
(one newly queued sample remained for the next two-minute batch). Authenticated
production API/browser checks passed on mobile and desktop; unauthenticated
planner API still returned 401. Live page showed 25.7 W and 0.25277 hours of
power-inferred blower runtime since observations began, with 16 history rows.
No control commands were sent during verification. The Furnace plug remained
ON with source button on final readback. The main planner upload/status remains
historical while paused; blower upload health is blower-events/upload-status.json.

Final service state: heatctl-blower active; heatctl, heatctl-watchdog.timer,
humid and fanctl inactive. No idle/heat-fire calibration samples yet; observed
power range remains 25.4–26.0 W, with the owner's separate 25.8 W fan-only label.
Installed code and tested conditions are hashed in blower-rollout-verification.json;
production checks are in blower-production-verification.json. Real stop-to-OFF
latency and 30-second relay lease acceptance remain pending the authorized manual
handoff; do not represent mocked tests as physical commissioning.

## November 26 evening: manual control is per component; reporting always runs

Owner correction at 21:21 CST (exact words saved by feedback.py, id
`a67bda6d-e21b-4e82-af47-25554bb97704`): manual control of one part must not
stop automation or reporting for the whole house. This supersedes the morning
whole-controller pause instructions above. Do not stop heatctl for an ordinary
manual fan, temperature, or humidifier adjustment.

Use `heatctl manual COMPONENT [2h]` BEFORE an external writer takes that component;
without a duration the claim lasts until `heatctl auto COMPONENT`. Components:
`upstairs-temperature`, `upstairs-fan`, `downstairs-temperature`,
`downstairs-fan`, `humidifier`. Commands change ownership, not equipment.
Claims are stored atomically in `ownership.json`; `heatctl owners` lists them.
Release only the relevant claim after the external writer stops. An in-flight
cloud request can finish after a claim, so confirm the current observation before
starting another writer. Do not resume legacy whole-house humid/fanctl services.

Heatctl remains running and reporting with claims active. A fan claim removes
only fan fields from writes, leaving temperature automation on the same thermostat.
Manual thermostat changes in either direction (including OFF) are detected from
fresh reads and preserved until the next schedule period. Inferred fan holds
persist until AUTO/OFF, native timer expiry, or scoped release. Explicit ownership
claims persist across schedule boundaries. The actuator rechecks ownership and
new device changes before sending. Fan-only Nest commands no longer exit Eco mode.

Humidifier manual ownership suppresses automatic ON; OFF remains permitted for
missing airflow, humidity limits, room safety, or shutdown. A physical/app OFF
before a verified ON lease expires creates a two-hour humidifier-only hold;
timer expiry and downtime do not. All automatic ON writes retain the verified
30-second lease and pinned .36 identity. Furnace .151 remains strictly read-only.
The independently controlled Airius fan retains its own existing manual-OFF logic.

`heatctl-telemetry.service` is enabled independently. When heatctl is stopped, it
collects read-only observations, maintains the legacy observation/CSV feed, and
uploads reporting-only events every minute using `telemetry-events/`. It does not
consume control commands, change control state, or start a humidity writer.
It yields both shared locks to the running controller, avoiding duplicate cloud
sessions. Reports are labeled shadow / REPORTING_ONLY while control is stopped;
no wake prediction is claimed then. The existing heatpush timer continues sending
normal snapshots every five minutes. Its prior repeated failures were caused by
stale humid/state.json after the whole controller was stopped.

At 21:25–21:26 the independent reporter and heatpush both received HTTP 200 /
acknowledged production uploads; authenticated `/api/heat/planner` and `/api/heat`
returned fresh room observations. Main control resumed at 21:28 with explicit
manual claims for upstairs fan and humidifier, conservatively preserving the
morning handoff while the owner was asked which parts remain manual. The observed
upstairs 68F change was detected and preserved for the evening period. Nest 70F
was already matched; the first resumed tick sent no thermostat writes. Humidifier
readback was OFF with ownership reported as manual. Watchdog timer resumed only
after a healthy main tick. Legacy humid/fanctl remain inactive, loftfan independent.

Tests cover component isolation, both-direction manual changes, stale/own-write
rejection, send-boundary rechecks, scoped release, read-only write rejection,
reporter/controller lock handoff, Nest fan-only Eco isolation, and humidity safety.
Physical manual-OFF detection and all real fan transitions are not forced for tests.
Backups: `backups/scoped-manual-20261126-212230/`.

Final validation: 70 Python tests passed. Authenticated production mobile browser
observed two automatic planner fetches over 32 seconds, zero page errors and zero
control POSTs. Production latest decision was live with upstairs fan/humidifier
manual claims and the independently inferred upstairs-temperature hold. Main
uploads were acknowledged with no pending events. Source is mirrored in
`~/tolley-heat-manual/ops/heatctl` (branch `codex/heat-scoped-manual`); runtime
credentials/state are excluded. Browser evidence: scoped-production-verification.json.

## November 26 nightly fire cutoff — owner instruction supersedes indefinite holds

Owner explicitly required a hard stove/fire cutoff every night at **01:00
America/Chicago**: Honeywell fan AUTO, humidifiers back to following blower.
Exact instruction and observations saved at 23:40 CST via feedback.py, id
`78caf020-674c-4ae2-8191-265e2be633bb`. This is clock-based; no fire-out detection
is available or inferred. Current room was 72.14F / 27.1% RH; upstairs fan ON,
setpoint 58F, neither furnace calling, relay observed OFF, power about 26W.

Installed policy is `fire-policy.json`, first cutoff **Nov 27, 2026, 01:00 CST**.
The current upstairs-fan and humidifier claims now expire at that exact deadline.
Future claims for these two components end no later than the next 1 AM cutoff;
other component claims retain their own duration. `heatctl owners` shows effective
expiry. All new stove durations are capped at the next 1 AM, including requests
created before midnight and consumed afterward. Earlier requested durations still
end earlier. A new explicit session started after the nightly boundary is a new
session, capped at its next 1 AM (and the existing eight-hour limit).

`heatctl-fire-cutoff.timer` is enabled, persistent, with America/Chicago calendar,
1-second accuracy and no randomized delay. Its oneshot writes a durable request,
starts heatctl if configured live but stopped, and wakes an already running
controller with SIGUSR1. No separate cloud writer or Nest refresher is created.
The running controller also checks calendar catch-up each tick/restart, so a missed
timer or command expiry cannot preserve yesterday's fire mode. At the deadline it
ends stove fan hold, removes old inferred upstairs-fan holds, and prioritizes a
fan-only AUTO request before the next full thermostat poll. Temperature settings,
Nest fan/temperature holds, Airius ownership and site reporting remain independent.
Old fan-ON requests are checked for deadline expiry before send and at the final
adapter boundary; slow work must not renew an expired stove fan hold.

Humidity resumes automatically when its owner claim expires, on the independent
10-second loop. Actual fresh power-inferred blower operation, RH cap/hysteresis,
room/season safety, pinned .36 identity, and verified 30-second ON lease still apply.
Fan AUTO is not a forced blower OFF: furnace heat/purge can continue, and humidity
follows that observed blower power. Furnace .151 remains strictly read-only.

AUTO remains pending until fresh readback confirms it. Cloud failures, an in-flight
poll, and existing attempt caps/backoff can delay physical fan switching; none of
those limits are reset or bypassed. Persistent FIRE_CUTOFF_AUTO_PENDING alerts and
`fire-cutoff-status.json` distinguish requests from confirmed AUTO. No claim of
physical completion at exactly 01:00 is made before the overnight readback.
Systemd calendar verified the next occurrence at 01:00 CST / 07:00 UTC. Validation
covers DST (first repeated 1 AM), midnight, delayed queued requests, missed-run
catch-up, scope isolation, no early cutoff, fan-only writes/readback, existing
rate limits, and delayed stale fan-ON rejection. No fire/fan transition was forced
for tests before the deadline. Backups: `backups/fire-cutoff-20261126-234045/`.

## November 27 savings and comfort accounting audit

Owner requested auditing tolley.io/heat and questioned the daily Nest 78F boost
(feedback id a18e722c-ee3e-491b-8732-728fd8749038). The boost is fixed policy:
78F when living-room shortfall is >=0.5F, otherwise 70F during occupied periods.
It is NOT selected by a least-cost optimizer. No temperature, wake schedule,
humidity limit or boost setting was changed during this reporting repair.

Authenticated production audit confirmed the old fireplace-as-furnace panel
persisted and the rolling morning forecast was updated until wake, obscuring
forecast error. The legacy "below target" counter also used a 1F allowance.
New `savings.py` accounting records exact occupied-target shortfall minutes and
degree-hours with observed coverage, morning burner runtime by zone, basement
ambient range, and the first observed warm-up prediction and its lead time.
A model forecast is not a measured causal contribution of basement heat.

New cost accounting splits gas by zone using the existing assumptions: upstairs
84k–120k input BTU/h, basement 40k, 1.037 therm/CCF, $1.23/CCF. This implies
$1.00–$1.42/upstairs burner-hour and $0.47/basement burner-hour. One basement
burner-hour must displace 20–29 upstairs burner-minutes to break even on modeled
gas alone. No such displacement has been demonstrated. Prices and input ratings
are assumptions, actual furnace stage/gas/electricity are not measured. Missing
water/sewer, furnace electricity and fireplace/wood costs are explicit.

Original logged decisions were replayed into supplementary `savings` summaries;
original raw events remain. First-warmup predictions on Nov 25/26/27 were
73.39/73.05/73.25F, while observed wake temperatures were 70.16/69.8/70.34F
against 71F goals. These replace misleading near-wake rolling prediction scores.
No retrospective savings are claimed. Main heat control/reporting was resumed
and existing temperature settings preserved. Backups:
`backups/savings-reporting-20261127-083307/`. Production website verification is
recorded separately after release; source changes alone are not deployment proof.
