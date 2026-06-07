import { ingestDocument } from "@/server/ai/rag/ingest";
import type { CfEnv } from "@/server/env";
import { hasCloudflareBindings } from "@/server/env";
import { createCfQueueProducer } from "./cf-queue";
import { createD1Postgres } from "./d1-postgres";
import { createD1Search } from "./d1-search";
import { createKvRedis } from "./kv-redis";
import {
  createMemoryPostgres,
  createMemoryQueue,
  createMemoryRedis,
  createMemorySearch,
} from "./memory-store";
import { createD1VectorStore, createMemoryVectorStore } from "./vector-store";
import type { StorageContext } from "./types";

let memoryStorage: StorageContext | null = null;

function createMemoryStorage(): StorageContext {
  if (memoryStorage) return memoryStorage;

  const postgres = createMemoryPostgres();
  const redis = createMemoryRedis();
  const search = createMemorySearch(postgres);
  const vectors = createMemoryVectorStore(postgres);

  const queue = createMemoryQueue(async (msg) => {
    if (msg.type === "ingest_document") {
      await ingestDocument(
        { postgres, redis, queue, search, vectors },
        msg.payload as {
          documentId: string;
          text: string;
          className: string;
          subject: string;
          filename: string;
        },
      );
    }
  });

  memoryStorage = { postgres, redis, queue, search, vectors };
  return memoryStorage;
}

/** Build storage from Cloudflare bindings (D1, KV, Queue, FTS). */
export function createCloudflareStorage(env: CfEnv): StorageContext {
  const postgres = createD1Postgres(env.DB);
  const redis = createKvRedis(env.CACHE);
  const search = createD1Search(env.DB);
  const queue = createCfQueueProducer(env.INGEST_QUEUE);
  const vectors = createD1VectorStore(postgres, env.SYLLABUS_VECTORS);

  return { postgres, redis, queue, search, vectors };
}

/**
 * Resolve storage for the current request.
 * Uses CF bindings when present (production / wrangler dev), else in-memory.
 */
export function getStorage(env?: unknown): StorageContext {
  if (hasCloudflareBindings(env)) {
    return createCloudflareStorage(env);
  }
  return createMemoryStorage();
}

/** Reset in-memory singleton (tests). */
export function resetStorage(): void {
  memoryStorage = null;
}
