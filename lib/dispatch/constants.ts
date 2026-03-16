// Red Alert Dispatch — rate constants and service area config

export const DISPATCH_RATES = {
  basePricePerMile: 2.0,
  minimumCharge: 15.0,
  platformFeePercent: 0.18,
  weightSurchargePerCwt: 2.0, // per 100 lbs over threshold
  weightSurchargeThreshold: 500, // lbs
  asapMultiplier: 1.35,
  scheduledDiscount: 0.05,
  trailerSurcharge: 25.0,
  tempControlSurcharge: 15.0,
  fragileSurcharge: 5.0,
  industryMarkup: 0.6, // 60% is industry standard markup
} as const;

export const DISPATCH_MATCHING = {
  maxDriversToNotify: 3,
  acceptTimeoutMin: 10,
  escalationTimeoutMin: 20,
  payBumpPercent: 0.1, // 10% bump on retry
  maxMatchAttempts: 3,
  defaultRadiusMi: 30,
  widenRadiusMi: 50,
  scoring: {
    proximityWeight: 0.4,
    ratingWeight: 0.3,
    completionWeight: 0.2,
    recencyWeight: 0.1,
    minRatingPreferred: 4.5,
  },
} as const;

export const DISPATCH_STATUS = {
  PENDING: "pending",
  MATCHING: "matching",
  ACCEPTED: "accepted",
  PICKUP_ENROUTE: "pickup_enroute",
  PICKED_UP: "picked_up",
  DELIVERING: "delivering",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
} as const;

export const DRIVER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
} as const;

export const VEHICLE_TYPES = [
  "sedan",
  "suv",
  "pickup",
  "van",
  "box_truck",
  "flatbed",
  "trailer",
] as const;

export const SERVICE_AREA = {
  centerLat: 39.0997,
  centerLng: -94.5786,
  name: "Kansas City Metro",
  maxRadiusMi: 60,
} as const;

export const ORDER_NUMBER_PREFIX = "RAD";
