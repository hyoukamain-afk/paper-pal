import type { RetrievedChunk, RetrievalFilters } from "@/server/storage/types";
import type { StorageContext } from "@/server/storage/types";

const RRF_K = 60;

/** Reciprocal Rank Fusion for hybrid retrieval lists. */
export function reciprocalRankFusion(lists: RetrievedChunk[][], k: number): RetrievedChunk[] {
  const scores = new Map<string, { chunk: RetrievedChunk; score: number }>();

  for (const list of lists) {
    list.forEach((chunk, rank) => {
      const rrf = 1 / (RRF_K + rank + 1);
      const existing = scores.get(chunk.id);
      if (existing) {
        existing.score += rrf;
      } else {
        scores.set(chunk.id, { chunk: { ...chunk, score: rrf }, score: rrf });
      }
    });
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk, score }) => ({ ...chunk, score }));
}

export async function bm25Search(
  storage: StorageContext,
  query: string,
  filters: RetrievalFilters,
  k = 15,
): Promise<RetrievedChunk[]> {
  return storage.search.search(query, filters, k);
}
