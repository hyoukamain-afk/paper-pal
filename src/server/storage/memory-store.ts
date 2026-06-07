import type { StreamEvent } from "@/lib/schemas/task";
import type {
  ChatMessageRecord,
  LlmJobRecord,
  PaperRecord,
  PostgresAdapter,
  QueueAdapter,
  QueueMessage,
  RedisAdapter,
  RetrievalFilters,
  RetrievedChunk,
  SearchAdapter,
  ChunkVector,
  SyllabusBook,
  SyllabusChunk,
  SyllabusDocument,
} from "./types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Simple BM25-style scoring for dev / Workers without external search. */
function bm25Score(
  query: string,
  doc: string,
  avgLen: number,
  df: Map<string, number>,
  N: number,
): number {
  const qTerms = tokenize(query);
  const dTerms = tokenize(doc);
  const docLen = dTerms.length || 1;
  const tf = new Map<string, number>();
  for (const t of dTerms) tf.set(t, (tf.get(t) ?? 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const term of qTerms) {
    const termFreq = tf.get(term) ?? 0;
    if (termFreq === 0) continue;
    const n = df.get(term) ?? 0.5;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    const norm = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + (b * docLen) / avgLen));
    score += idf * norm;
  }
  return score;
}

export function createMemoryPostgres(): PostgresAdapter {
  const papers = new Map<string, PaperRecord>();
  const messages: ChatMessageRecord[] = [];
  const jobs = new Map<string, LlmJobRecord>();
  const documents = new Map<string, SyllabusDocument>();
  const books = new Map<string, SyllabusBook>();
  const chunks: SyllabusChunk[] = [];
  const chunkVectors = new Map<string, number[]>();

  const chunkMatches = (c: SyllabusChunk, filters: RetrievalFilters) => {
    if (filters.className && c.className !== filters.className) return false;
    if (filters.subject && c.subject !== filters.subject) return false;
    if (filters.chapter && c.chapter !== filters.chapter) return false;
    if (filters.documentIds?.length && !filters.documentIds.includes(c.documentId)) return false;
    if (filters.chapters?.length) {
      const ok = filters.chapters.some((ch) =>
        c.chapter.toLowerCase().includes(ch.toLowerCase()),
      );
      if (!ok) return false;
    }
    return true;
  };

  return {
    async savePaper(record) {
      papers.set(record.id, record);
    },
    async getPaper(id) {
      return papers.get(id) ?? null;
    },
    async listPapersBySession(sessionId) {
      return [...papers.values()].filter((p) => p.sessionId === sessionId);
    },
    async saveChatMessage(msg) {
      messages.push(msg);
    },
    async listChatMessages(sessionId, paperId) {
      return messages.filter(
        (m) => m.sessionId === sessionId && (!paperId || m.paperId === paperId),
      );
    },
    async createJob(job) {
      jobs.set(job.id, job);
    },
    async updateJob(id, patch) {
      const cur = jobs.get(id);
      if (cur) jobs.set(id, { ...cur, ...patch, updatedAt: new Date().toISOString() });
    },
    async getJob(id) {
      return jobs.get(id) ?? null;
    },
    async saveDocument(doc) {
      documents.set(doc.id, doc);
    },
    async getDocument(id) {
      return documents.get(id) ?? null;
    },
    async saveChunks(newChunks) {
      chunks.push(...newChunks);
    },
    async listChunks(filters) {
      return chunks.filter((c) => chunkMatches(c, filters));
    },
    async saveBook(book) {
      books.set(book.id, book);
    },
    async getBook(id) {
      return books.get(id) ?? null;
    },
    async listBooks(filters) {
      return [...books.values()].filter((b) => {
        if (filters.board && b.board !== filters.board) return false;
        if (filters.className && b.className !== filters.className) return false;
        if (filters.subject && b.subject !== filters.subject) return false;
        if (filters.status && b.status !== filters.status) return false;
        return true;
      });
    },
    async saveChunkVectors(vectors) {
      for (const v of vectors) chunkVectors.set(v.chunkId, v.embedding);
    },
    async listChunkVectors(chunkIds) {
      return chunkIds
        .map((id) => {
          const embedding = chunkVectors.get(id);
          return embedding ? { chunkId: id, embedding } : null;
        })
        .filter((v): v is ChunkVector => v != null);
    },
  };
}

export function createMemoryRedis(): RedisAdapter {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  const locks = new Set<string>();

  const getRaw = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value;
  };

  return {
    async get(key) {
      return getRaw(key);
    },
    async set(key, value, ttlSeconds) {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      });
    },
    async del(key) {
      store.delete(key);
    },
    async acquireLock(key, ttlSeconds) {
      if (locks.has(key)) return false;
      locks.add(key);
      setTimeout(() => locks.delete(key), ttlSeconds * 1000);
      return true;
    },
    async releaseLock(key) {
      locks.delete(key);
    },
    async getIdempotentResult(key) {
      const raw = getRaw(`idem:${key}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StreamEvent[];
      } catch {
        return null;
      }
    },
    async setIdempotentResult(key, events, ttlSeconds) {
      await this.set(`idem:${key}`, JSON.stringify(events), ttlSeconds);
    },
    async getPaperSummary(paperId) {
      return getRaw(`summary:${paperId}`);
    },
    async setPaperSummary(paperId, summary, ttlSeconds) {
      await this.set(`summary:${paperId}`, summary, ttlSeconds);
    },
    async checkRateLimit(userKey, limit, windowSeconds) {
      const key = `rl:${userKey}`;
      const raw = getRaw(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= limit) return false;
      await this.set(key, String(count + 1), windowSeconds);
      return true;
    },
  };
}

export function createMemoryQueue(onProcess: (msg: QueueMessage) => Promise<void>): QueueAdapter {
  const queue: QueueMessage[] = [];
  let processing = false;

  const drain = async () => {
    if (processing || queue.length === 0) return;
    processing = true;
    while (queue.length > 0) {
      const msg = queue.shift()!;
      try {
        await onProcess(msg);
      } catch (err) {
        console.error("Queue job failed", msg.type, err);
      }
    }
    processing = false;
  };

  return {
    async enqueue(msg) {
      const id = `q_${Date.now().toString(36)}`;
      queue.push({ ...msg, id, createdAt: new Date().toISOString() });
      void drain();
      return id;
    },
    async processNext(handler) {
      if (queue.length === 0) return;
      const msg = queue[0];
      await handler(msg);
      queue.shift();
    },
  };
}

export function createMemorySearch(postgres: PostgresAdapter): SearchAdapter {
  let syllabusVersion = 1;
  const df = new Map<string, number>();
  let N = 1;
  let avgLen = 100;

  return {
    async indexChunks(newChunks, version) {
      syllabusVersion = version;
      const all = await postgres.listChunks({});
      N = Math.max(1, all.length);
      avgLen = all.reduce((s, c) => s + tokenize(c.text).length, 0) / N;
      df.clear();
      for (const c of all) {
        const terms = new Set(tokenize(c.text));
        for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
      }
    },
    async search(query, filters, k) {
      const candidates = await postgres.listChunks(filters);
      const scored: RetrievedChunk[] = candidates.map((c) => ({
        ...c,
        score: bm25Score(query, c.text, avgLen, df, N),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, k);
    },
  };
}
