#!/bin/bash
# Pool360 Sync Health Check
# Alerts if no successful sync in the last 36 hours.
# Designed to run daily via cron (e.g. 8am, after the 4am sync).

LOG="/home/jelly/tolley-site/logs/pool360-sync.log"
ALERT_LOG="/home/jelly/tolley-site/logs/pool360-alerts.log"
HOURS_THRESHOLD=36

if [ ! -f "$LOG" ]; then
  echo "[$(date -Iseconds)] ALERT: pool360-sync.log does not exist" >> "$ALERT_LOG"
  exit 1
fi

# Check if log was modified within threshold
LAST_MOD=$(stat -c %Y "$LOG" 2>/dev/null)
NOW=$(date +%s)
AGE_HOURS=$(( (NOW - LAST_MOD) / 3600 ))

if [ "$AGE_HOURS" -ge "$HOURS_THRESHOLD" ]; then
  echo "[$(date -Iseconds)] ALERT: Pool360 sync log is ${AGE_HOURS}h old (threshold: ${HOURS_THRESHOLD}h). Sync may be failing." >> "$ALERT_LOG"
  exit 1
fi

# Check last run result
LAST_DONE=$(grep -n '^\[main\] Done\.' "$LOG" | tail -1)
LAST_FATAL=$(grep -n '^\[main\] Fatal' "$LOG" | tail -1)

DONE_LINE=$(echo "$LAST_DONE" | cut -d: -f1)
FATAL_LINE=$(echo "$LAST_FATAL" | cut -d: -f1)

# Default to 0 if not found
DONE_LINE=${DONE_LINE:-0}
FATAL_LINE=${FATAL_LINE:-0}

if [ "$FATAL_LINE" -gt "$DONE_LINE" ]; then
  echo "[$(date -Iseconds)] ALERT: Last Pool360 sync CRASHED. Check $LOG" >> "$ALERT_LOG"
  exit 1
fi

# Check if last sync got prices (look for "Fully authenticated" vs "Not fully authenticated")
LAST_AUTH=$(grep 'authenticated' "$LOG" | tail -1)
if echo "$LAST_AUTH" | grep -q "Not fully"; then
  echo "[$(date -Iseconds)] WARNING: Pool360 session not authenticated — stock-only sync (no prices)" >> "$ALERT_LOG"
fi

# Check sync created+updated count
LAST_RESULT=$(grep -A4 '\[sync\] Result' "$LOG" | tail -5)
CREATED=$(echo "$LAST_RESULT" | grep '"created"' | grep -oP '\d+')
UPDATED=$(echo "$LAST_RESULT" | grep '"updated"' | grep -oP '\d+')
TOTAL=$((${CREATED:-0} + ${UPDATED:-0}))

if [ "$TOTAL" -eq 0 ]; then
  echo "[$(date -Iseconds)] ALERT: Last Pool360 sync synced 0 products. Check scraper." >> "$ALERT_LOG"
  exit 1
fi

echo "[$(date -Iseconds)] OK: Pool360 sync healthy. Last run: ${TOTAL} products synced (${CREATED:-0} new, ${UPDATED:-0} updated). Log age: ${AGE_HOURS}h" >> "$ALERT_LOG"
exit 0
