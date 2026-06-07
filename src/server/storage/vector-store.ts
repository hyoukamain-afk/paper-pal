import { cosineSimilarity } from "@/server/ai/embeddings";
import type {
  ChunkVector,
  PostgresAdapter,
  RetrievedChunk,
  RetrievalFilters,
  VectorAdapter,
} from "./types";

function matchesFilters(chunk: RetrievedChunk, filters: RetrievalFilters): boolean {
  if (filters.className && chunk.className !== filters.className) return false;
  if (filters.subject && chunk.subject !== filters.subject) return false;
  if (filters.chapter && chunk.chapter !== filters.chapter) return false;
  if (filters.documentIds?.length && !filters.documentIds.includes(chunk.documentId)) {
    return false;
  }
  if (filters.chapters?.length) {
    const chapter = chunk.chapter.toLowerCase();
    const ok = filters.chapters.some((c) => chapter.includes(c.toLowerCase()));
    if (!ok) return false;
  }
  return true;
}

export function createMemoryVectorStore(postgres: PostgresAdapter): VectorAdapter {
  const cache = new Map<string, number[]>();

  return {
    async upsert(vectors) {
      for (const v of vectors) cache.set(v.chunkId, v.embedding);
      await postgres.saveChunkVectors(vectors);
    },

    async search(queryEmbedding, filters, k) {
      const candidates = await postgres.listChunks({
        className: filters.className,
        subject: filters.subject,
        documentIds: filters.documentIds,
        chapters: filters.chapters,
      });
      if (candidates.length === 0) return [];

      const ids = candidates.map((c) => c.id);
      const stored = await postgres.listChunkVectors(ids);
      const byId = new Map(stored.map((v) => [v.chunkId, v.embedding]));

      const scored: RetrievedChunk[] = [];
      for (const chunk of candidates) {
        const embedding = cache.get(chunk.id) ?? byId.get(chunk.id);
        if (!embedding) continue;
        const row: RetrievedChunk = { ...chunk, score: cosineSimilarity(queryEmbedding, embedding) };
        if (!matchesFilters(row, filters)) continue;
        scored.push(row);
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, k);
    },
  };
}

export function createD1VectorStore(
  postgres: PostgresAdapter,
  vectorize?: VectorizeIndex,
): VectorAdapter {
  const memory = createMemoryVectorStore(postgres);

  return {
    async upsert(vectors) {
      await memory.upsert(vectors);
      if (!vectorize || vectors.length === 0) return;

      await vectorize.upsert(
        vectors.map((v) => ({
          id: v.chunkId,
          values: v.embedding,
          metadata: { chunkId: v.chunkId },
        })),
      );
    },

    async search(queryEmbedding, filters, k) {
      if (vectorize) {
        try {
          const matches = await vectorize.query(queryEmbedding, {
            topK: k * 3,
            returnMetadata: true,
          });
          const chunkIds = matches.matches.map((m) => String(m.id));
          const chunks = await postgres.listChunks({ ...filters, documentIds: undefined });
          const byId = new Map(chunks.map((c) => [c.id, c]));
          const results: RetrievedChunk[] = [];
          for (const match of matches.matches) {
            const chunk = byId.get(String(match.id));
            if (!chunk || !matchesFilters({ ...chunk, score: match.score ?? 0 }, filters)) {
              continue;
            }
            results.push({ ...chunk, score: match.score ?? 0 });
          }
          if (results.length > 0) return results.slice(0, k);
        } catch (err) {
          console.warn("Vectorize query failed, using D1 vectors", err);
        }
      }
      return memory.search(queryEmbedding, filters, k);
    },
  };
}
