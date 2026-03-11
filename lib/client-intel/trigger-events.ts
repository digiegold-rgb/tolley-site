export const TRIGGER_EVENT_TYPES = [
  "job_relocation",
  "marriage",
  "baby",
  "promotion",
  "divorce",
  "retirement",
  "rental_complaints",
  "graduation",
] as const;

export type TriggerEventType = (typeof TRIGGER_EVENT_TYPES)[number];

interface TriggerConfig {
  baseScore: number;
  maxTimelineMonths: number;
  strength: string;
  label: string;
}

const TRIGGER_CONFIG: Record<TriggerEventType, TriggerConfig> = {
  job_relocation: { baseScore: 30, maxTimelineMonths: 3, strength: "very_high", label: "Job Relocation" },
  marriage: { baseScore: 25, maxTimelineMonths: 12, strength: "high", label: "Marriage / Engagement" },
  baby: { baseScore: 25, maxTimelineMonths: 9, strength: "high", label: "Baby Announcement" },
  promotion: { baseScore: 20, maxTimelineMonths: 18, strength: "medium_high", label: "Promotion / Raise" },
  divorce: { baseScore: 22, maxTimelineMonths: 6, strength: "medium_high", label: "Divorce" },
  retirement: { baseScore: 18, maxTimelineMonths: 12, strength: "medium", label: "Retirement" },
  rental_complaints: { baseScore: 15, maxTimelineMonths: 6, strength: "medium", label: "Rental Complaints" },
  graduation: { baseScore: 12, maxTimelineMonths: 18, strength: "medium", label: "Graduation" },
};

export function getTriggerConfig(type: TriggerEventType): TriggerConfig {
  return TRIGGER_CONFIG[type];
}

export function getTriggerLabel(type: string): string {
  return TRIGGER_CONFIG[type as TriggerEventType]?.label || type;
}

export function calculateDecayedScore(baseScore: number, maxTimelineMonths: number, occurredAt: Date): number {
  const now = new Date();
  const monthsSince = (now.getTime() - occurredAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const decayHorizon = maxTimelineMonths * 2;
  const factor = Math.max(0, 1 - monthsSince / decayHorizon);
  return Math.round(baseScore * factor);
}

export function calculateReadinessScore(
  events: { type: string; occurredAt: Date }[]
): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};
  let total = 0;

  for (const event of events) {
    const config = TRIGGER_CONFIG[event.type as TriggerEventType];
    if (!config) continue;
    const decayed = calculateDecayedScore(config.baseScore, config.maxTimelineMonths, event.occurredAt);
    if (decayed > 0) {
      factors[event.type] = (factors[event.type] || 0) + decayed;
      total += decayed;
    }
  }

  return { score: Math.min(100, total), factors };
}

export { TRIGGER_CONFIG };
