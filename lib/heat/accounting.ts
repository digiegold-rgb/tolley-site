/** Same input-rating assumptions as Spark heatpush, not utility-meter readings. */
export const GAS_USD_PER_CCF = 1.23;
export function gasFromRuntime(upstairsH: number, downstairsH: number) {
  const unit = GAS_USD_PER_CCF / 1.037;
  return {
    low: (upstairsH * 0.84 + downstairsH * 0.4) * unit,
    high: (upstairsH * 1.2 + downstairsH * 0.4) * unit,
  };
}

export const FIREPLACE_DEVICE_ID = "shellyplugusg4-98c37700c550";
export function furnaceBlowerStatus(row: Record<string, unknown>, now = Date.now()) {
  const observed = typeof row.observed_at === "number" ? row.observed_at * 1000 : NaN;
  const valid = row.device_id === "honeywell" && row.source === "honeywell_fan_status"
    && row.valid === true && typeof row.running === "boolean"
    && now >= observed && now - observed <= 90_000;
  return valid ? row.running ? "Running" : "Stopped" : "Unknown";
}
