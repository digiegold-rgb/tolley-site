# Heat operations and owner feedback

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
Physical airflow interlocks were not independently verified or rewired. Live
software requires refreshed upstairs blower-running telemetry before relay ON,
heat/purge or explicitly selected stove mode, and a verified 600-second lease.

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
