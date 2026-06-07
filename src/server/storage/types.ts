import type { Paper } from "@/lib/types";
import type { LlmTask, StreamEvent } from "@/lib/schemas/task";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type LlmJobRecord = {
  id: string;
  taskType: string;
  status: JobStatus;
  inputHash: string;
  outputJson?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaperRecord = {
  id: string;
  sessionId: string;
  userId?: string;
  version: number;
  data: Paper;
  updatedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  sessionId: string;
  paperId?: string;
  role: "user" | "assistant";
  content: string;
  state?: string;
  createdAt: string;
};

export type SyllabusChunk = {
  id: string;
  documentId: string;
  text: string;
  className: string;
  subject: string;
  chapter: string;
  page?: number;
  topicTags: string[];
};

export type SyllabusDocument = {
  id: string;
  sessionId: string;
  filename: string;
  className: string;
  subject: string;
  status: "pending" | "indexed" | "failed";
  syllabusVersion: number;
  createdAt: string;
  r2Key?: string;
  bookId?: string;
};

export type SyllabusBook = {
  id: string;
  board: string;
  className: string;
  subject: string;
  title: string;
  publisher?: string;
  edition?: string;
  topics: string[];
  documentId: string;
  r2Key: string;
  status: "draft" | "indexed" | "archived";
  chunkCount: number;
  createdAt: string;
};

export type ChunkVector = {
  chunkId: string;
  embedding: number[];
};

export type QueueMessage = {
  id: string;
  type: "ingest_document" | "generate_paper";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RetrievalFilters = {
  className?: string;
  subject?: string;
  chapter?: string;
  documentIds?: string[];
  chapters?: string[];
};

export type RetrievedChunk = SyllabusChunk & { score: number };

export interface PostgresAdapter {
  savePaper(record: PaperRecord): Promise<void>;
  getPaper(id: string): Promise<PaperRecord | null>;
  listPapersBySession(sessionId: string): Promise<PaperRecord[]>;
  saveChatMessage(msg: ChatMessageRecord): Promise<void>;
  listChatMessages(sessionId: string, paperId?: string): Promise<ChatMessageRecord[]>;
  createJob(job: LlmJobRecord): Promise<void>;
  updateJob(id: string, patch: Partial<LlmJobRecord>): Promise<void>;
  getJob(id: string): Promise<LlmJobRecord | null>;
  saveDocument(doc: SyllabusDocument): Promise<void>;
  getDocument(id: string): Promise<SyllabusDocument | null>;
  saveChunks(chunks: SyllabusChunk[]): Promise<void>;
  listChunks(filters: RetrievalFilters): Promise<SyllabusChunk[]>;
  saveBook(book: SyllabusBook): Promise<void>;
  getBook(id: string): Promise<SyllabusBook | null>;
  listBooks(filters: {
    board?: string;
    className?: string;
    subject?: string;
    status?: SyllabusBook["status"];
  }): Promise<SyllabusBook[]>;
  saveChunkVectors(vectors: ChunkVector[]): Promise<void>;
  listChunkVectors(chunkIds: string[]): Promise<ChunkVector[]>;
}

export interface VectorAdapter {
  /** One-time upsert at ingest — not per teacher request. */
  upsert(vectors: ChunkVector[]): Promise<void>;
  /** Query-time: embed query once, search pre-indexed vectors. */
  search(
    queryEmbedding: number[],
    filters: RetrievalFilters,
    k: number,
  ): Promise<RetrievedChunk[]>;
}

export interface RedisAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
  getIdempotentResult(key: string): Promise<StreamEvent[] | null>;
  setIdempotentResult(key: string, events: StreamEvent[], ttlSeconds: number): Promise<void>;
  getPaperSummary(paperId: string): Promise<string | null>;
  setPaperSummary(paperId: string, summary: string, ttlSeconds: number): Promise<void>;
  checkRateLimit(userKey: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export interface QueueAdapter {
  enqueue(msg: Omit<QueueMessage, "id" | "createdAt">): Promise<string>;
  processNext(handler: (msg: QueueMessage) => Promise<void>): Promise<void>;
}

export interface SearchAdapter {
  indexChunks(chunks: SyllabusChunk[], syllabusVersion: number): Promise<void>;
  search(query: string, filters: RetrievalFilters, k: number): Promise<RetrievedChunk[]>;
}

export type StorageContext = {
  postgres: PostgresAdapter;
  redis: RedisAdapter;
  queue: QueueAdapter;
  search: SearchAdapter;
  vectors: VectorAdapter;
};

export type TraceLog = {
  taskType: LlmTask["taskType"];
  trigger: string;
  latencyMs: number;
  retrievalIds: string[];
  cached: boolean;
};
