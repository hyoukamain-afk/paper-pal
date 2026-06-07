import type { StreamEvent } from "@/lib/schemas/task";
import type { RedisAdapter } from "./types";

export function createKvRedis(kv: KVNamespace): RedisAdapter {
  return {
    async get(key) {
      return kv.get(key);
    },

    async set(key, value, ttlSeconds) {
      await kv.put(key, value, ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
    },

    async del(key) {
      await kv.delete(key);
    },

    async acquireLock(key, ttlSeconds) {
      const lockKey = `lock:${key}`;
      const existing = await kv.get(lockKey);
      if (existing) return false;
      await kv.put(lockKey, "1", { expirationTtl: ttlSeconds });
      return true;
    },

    async releaseLock(key) {
      await kv.delete(`lock:${key}`);
    },

    async getIdempotentResult(key) {
      const raw = await kv.get(`idem:${key}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StreamEvent[];
      } catch {
        return null;
      }
    },

    async setIdempotentResult(key, events, ttlSeconds) {
      await kv.put(`idem:${key}`, JSON.stringify(events), { expirationTtl: ttlSeconds });
    },

    async getPaperSummary(paperId) {
      return kv.get(`summary:${paperId}`);
    },

    async setPaperSummary(paperId, summary, ttlSeconds) {
      await kv.put(`summary:${paperId}`, summary, { expirationTtl: ttlSeconds });
    },

    async checkRateLimit(userKey, limit, windowSeconds) {
      const key = `rl:${userKey}`;
      const raw = await kv.get(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= limit) return false;
      await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
      return true;
    },
  };
}
