/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");

const ROTATION_MS = Number(process.env.PREFERENCE_SALT_ROTATION_MS || 1000 * 60 * 60 * 24);
const LEGACY_SALT_COUNT = 2;

const preferencesByIdentity = new Map();
let currentSalt = crypto.randomBytes(24).toString("hex");
let saltExpiresAt = Date.now() + ROTATION_MS;
let legacySalts = [];

function normalizeIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) {
    return String(forwardedValue).split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "0.0.0.0";
}

function rotateSaltIfNeeded() {
  if (Date.now() < saltExpiresAt) {
    return;
  }

  legacySalts = [currentSalt, ...legacySalts].slice(0, LEGACY_SALT_COUNT);
  currentSalt = crypto.randomBytes(24).toString("hex");
  saltExpiresAt = Date.now() + ROTATION_MS;
}

function hashIdentity(value, salt) {
  return crypto.createHash("sha256").update(`${value}:${salt}`).digest("hex");
}

function resolveIdentityKey(req) {
  const userId = req.headers["x-user-id"];
  if (typeof userId === "string" && userId.trim()) {
    return {
      type: "userId",
      key: `uid:${userId.trim()}`,
    };
  }

  rotateSaltIfNeeded();
  const ip = normalizeIp(req);
  const candidateSalts = [currentSalt, ...legacySalts];

  for (const salt of candidateSalts) {
    const candidateKey = `anon:${hashIdentity(ip, salt)}`;
    if (preferencesByIdentity.has(candidateKey)) {
      return {
        type: "anon",
        key: candidateKey,
      };
    }
  }

  return {
    type: "anon",
    key: `anon:${hashIdentity(ip, currentSalt)}`,
  };
}

function getStoredPreferences(identityKey) {
  return preferencesByIdentity.get(identityKey) || null;
}

function savePreferences(identityKey, currentPreferences, explicitPreferences) {
  const stored = getStoredPreferences(identityKey) || {};

  const merged = {
    budgetRange:
      explicitPreferences.budgetRange || stored.budgetRange || currentPreferences.budgetRange || null,
    minBeds:
      explicitPreferences.minBeds ?? stored.minBeds ?? currentPreferences.minBeds ?? null,
    minBaths:
      explicitPreferences.minBaths ?? stored.minBaths ?? currentPreferences.minBaths ?? null,
    preferredAreas: Array.from(
      new Set([
        ...(explicitPreferences.preferredAreas || []),
        ...(stored.preferredAreas || []),
      ]),
    ).slice(0, 5),
    updatedAt: new Date().toISOString(),
  };

  preferencesByIdentity.set(identityKey, merged);
  return merged;
}

function applyPreferenceDefaults(parsedCriteria, storedPreferences) {
  if (!storedPreferences) {
    return {
      ...parsedCriteria,
      defaultsApplied: false,
    };
  }

  const criteria = { ...parsedCriteria };
  let defaultsApplied = false;

  if (!criteria.maxPrice && storedPreferences.budgetRange?.max) {
    criteria.maxPrice = storedPreferences.budgetRange.max;
    defaultsApplied = true;
  }

  if (!criteria.minBeds && typeof storedPreferences.minBeds === "number") {
    criteria.minBeds = storedPreferences.minBeds;
    defaultsApplied = true;
  }

  if (!criteria.minBaths && typeof storedPreferences.minBaths === "number") {
    criteria.minBaths = storedPreferences.minBaths;
    defaultsApplied = true;
  }

  if (
    (!criteria.city || !criteria.state) &&
    Array.isArray(storedPreferences.preferredAreas) &&
    storedPreferences.preferredAreas.length > 0
  ) {
    const [firstArea] = storedPreferences.preferredAreas;
    if (firstArea?.city && !criteria.city) {
      criteria.city = firstArea.city;
      defaultsApplied = true;
    }
    if (firstArea?.state && !criteria.state) {
      criteria.state = firstArea.state;
      defaultsApplied = true;
    }
  }

  return {
    ...criteria,
    defaultsApplied,
  };
}

module.exports = {
  resolveIdentityKey,
  getStoredPreferences,
  applyPreferenceDefaults,
  savePreferences,
};
