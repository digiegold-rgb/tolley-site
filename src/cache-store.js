/* eslint-disable @typescript-eslint/no-require-imports */

const ONE_HOUR_MS = 60 * 60 * 1000;

class InMemoryCacheStore {
  constructor() {
    this.records = new Map();
  }

  get(key) {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }

    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return null;
    }

    return record.value;
  }

  set(key, value, ttlMs) {
    this.records.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

const memoryStore = new InMemoryCacheStore();
let redisClientPromise = null;
let warnedRedisFallback = false;

async function getRedisClient() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        // Optional dependency. Falls back to memory when unavailable.
        const redis = require("redis");
        const client = redis.createClient({ url: process.env.REDIS_URL });
        client.on("error", (error) => {
          console.error("[cache] redis client error:", error.message);
        });
        if (!client.isOpen) {
          await client.connect();
        }
        return client;
      } catch {
        if (!warnedRedisFallback) {
          warnedRedisFallback = true;
          console.warn(
            "[cache] REDIS_URL is set but redis client is unavailable; using in-memory TTL cache.",
          );
        }
        return null;
      }
    })();
  }

  return redisClientPromise;
}

async function getCachedValue(key) {
  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      const rawValue = await redisClient.get(key);
      if (!rawValue) {
        return null;
      }
      return JSON.parse(rawValue);
    } catch (error) {
      console.error("[cache] redis read error:", error.message);
    }
  }

  return memoryStore.get(key);
}

async function setCachedValue(key, value, ttlMs = ONE_HOUR_MS) {
  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), { PX: ttlMs });
    } catch (error) {
      console.error("[cache] redis write error:", error.message);
    }
  }

  memoryStore.set(key, value, ttlMs);
}

function getHourBucket(now = Date.now()) {
  return Math.floor(now / ONE_HOUR_MS);
}

module.exports = {
  ONE_HOUR_MS,
  getCachedValue,
  setCachedValue,
  getHourBucket,
};
