/**
 * Client Fit Score — calculates how well a client's preferences align
 * with available listings. The more info the agent has, the higher the
 * potential score. This score adds to the Buy/Sell scores for perfect matching.
 *
 * Factors:
 * - Profile completeness (more data = better matching potential)
 * - Budget alignment with market
 * - Timeline urgency
 * - Preference specificity (the more specific, the better matches)
 */

interface ClientData {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  buyerSeller: string;
  preApproved: boolean;
  preApprovalAmount?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBeds?: number | null;
  maxBeds?: number | null;
  minBaths?: number | null;
  minSqft?: number | null;
  maxSqft?: number | null;
  preferredCities: string[];
  preferredZips: string[];
  preferredPropertyTypes: string[];
  moveTimeline?: string | null;
  currentCity?: string | null;
  movingFrom?: string | null;
  birthday?: string | null;
  household?: string | null;
  kids?: number | null;
  pets?: string | null;
  occupation?: string | null;
  interests: string[];
  dealbreakers: string[];
  noteCount?: number;
  // Client intelligence fields
  estimatedIncome?: number | null;
  incomeConfidence?: string | null;
  readinessScore?: number | null;
  discType?: string | null;
}

interface ScoreFactors {
  [key: string]: number;
  profileCompleteness: number;
  budgetClarity: number;
  timelineUrgency: number;
  preferenceDepth: number;
  socialPresence: number;
  agentKnowledge: number;
  incomeClarity: number;
  triggerHeat: number;
  personalityInsight: number;
}

export function calculateClientFitScore(client: ClientData): {
  score: number;
  factors: ScoreFactors;
} {
  const factors: ScoreFactors = {
    profileCompleteness: 0,
    budgetClarity: 0,
    timelineUrgency: 0,
    preferenceDepth: 0,
    socialPresence: 0,
    agentKnowledge: 0,
    incomeClarity: 0,
    triggerHeat: 0,
    personalityInsight: 0,
  };

  // Profile completeness (0-25 points)
  let profileFields = 0;
  const totalProfileFields = 12;
  if (client.email) profileFields++;
  if (client.phone) profileFields++;
  if (client.birthday) profileFields++;
  if (client.household) profileFields++;
  if (client.kids != null) profileFields++;
  if (client.pets) profileFields++;
  if (client.occupation) profileFields++;
  if (client.currentCity) profileFields++;
  if (client.movingFrom) profileFields++;
  if (client.buyerSeller) profileFields++;
  if (client.interests.length > 0) profileFields++;
  if (client.dealbreakers.length > 0) profileFields++;
  factors.profileCompleteness = Math.round((profileFields / totalProfileFields) * 25);

  // Budget clarity (0-20 points)
  if (client.preApproved && client.preApprovalAmount) {
    factors.budgetClarity = 20;
  } else if (client.minPrice && client.maxPrice) {
    factors.budgetClarity = 15;
  } else if (client.maxPrice || client.minPrice) {
    factors.budgetClarity = 8;
  }

  // Timeline urgency (0-15 points)
  const timelineScores: Record<string, number> = {
    asap: 15,
    "1-3months": 12,
    "3-6months": 8,
    "6-12months": 5,
    just_looking: 2,
  };
  factors.timelineUrgency = timelineScores[client.moveTimeline || ""] || 0;

  // Preference depth (0-20 points)
  let prefPoints = 0;
  if (client.preferredCities.length > 0) prefPoints += 5;
  if (client.preferredZips.length > 0) prefPoints += 5;
  if (client.preferredPropertyTypes.length > 0) prefPoints += 4;
  if (client.minBeds || client.maxBeds) prefPoints += 3;
  if (client.minBaths) prefPoints += 2;
  if (client.minSqft || client.maxSqft) prefPoints += 1;
  factors.preferenceDepth = Math.min(prefPoints, 20);

  // Social presence (0-10 points)
  let socialCount = 0;
  if (client.facebookUrl) socialCount++;
  if (client.instagramUrl) socialCount++;
  if (client.linkedinUrl) socialCount++;
  factors.socialPresence = Math.min(socialCount * 4, 10);

  // Agent knowledge from notes (0-10 points)
  const noteCount = client.noteCount || 0;
  if (noteCount >= 10) factors.agentKnowledge = 10;
  else if (noteCount >= 5) factors.agentKnowledge = 7;
  else if (noteCount >= 3) factors.agentKnowledge = 5;
  else if (noteCount >= 1) factors.agentKnowledge = 3;

  // Income clarity (0-10 points)
  if (client.estimatedIncome) {
    if (client.incomeConfidence === "high") factors.incomeClarity = 10;
    else if (client.incomeConfidence === "medium") factors.incomeClarity = 7;
    else factors.incomeClarity = 4;
  }

  // Trigger heat (0-10 points) — readinessScore / 10
  if (client.readinessScore) {
    factors.triggerHeat = Math.min(10, Math.round(client.readinessScore / 10));
  }

  // Personality insight (0-10 points)
  if (client.discType) {
    factors.personalityInsight = 10;
  }

  const rawScore =
    factors.profileCompleteness +
    factors.budgetClarity +
    factors.timelineUrgency +
    factors.preferenceDepth +
    factors.socialPresence +
    factors.agentKnowledge +
    factors.incomeClarity +
    factors.triggerHeat +
    factors.personalityInsight;

  // Normalize: 130 raw max → 0-100
  const score = Math.min(100, Math.round((rawScore / 130) * 100));

  return { score, factors };
}
