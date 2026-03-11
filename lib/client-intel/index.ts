export { estimateIncome } from "./income";
export { calculateAffordability } from "./affordability";
export { DISC_QUESTIONS, scoreDISC, getDISCPlaybook } from "./disc";
export type { DISCQuestion, DISCResult, DISCPlaybook } from "./disc";
export {
  TRIGGER_EVENT_TYPES,
  TRIGGER_CONFIG,
  getTriggerConfig,
  getTriggerLabel,
  calculateDecayedScore,
  calculateReadinessScore,
} from "./trigger-events";
export type { TriggerEventType } from "./trigger-events";
export { calculateMatchScore } from "./match";
export {
  INCOME_DISCLAIMER,
  AFFORDABILITY_DISCLAIMER,
  FAIR_HOUSING_DISCLAIMER,
  DISC_DISCLAIMER,
  PROTECTED_CLASSES,
} from "./compliance";
