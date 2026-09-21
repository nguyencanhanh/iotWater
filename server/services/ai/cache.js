import crypto from "crypto";
import { clientRedis } from "../../mqtt/redis.js";
import { aiConfig } from "./config.js";

const isRedisReady = () => Boolean(clientRedis?.isOpen);

export const buildCacheKey = (namespace, payload) => {
  const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
  return `${aiConfig.cachePrefix}${namespace}:${hash}`;
};

export const readCache = async (key) => {
  if (!aiConfig.cacheEnabled || !key || !isRedisReady()) return null;
  try {
    const raw = await clientRedis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("[ai] cache read failed:", error.message);
    return null;
  }
};

export const writeCache = async (key, value, ttlSeconds = aiConfig.cacheTtlSeconds) => {
  if (!aiConfig.cacheEnabled || !key || !isRedisReady()) return false;
  try {
    await clientRedis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (error) {
    console.error("[ai] cache write failed:", error.message);
    return false;
  }
};
