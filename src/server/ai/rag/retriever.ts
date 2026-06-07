import { embedQuery } from "@/server/ai/embeddings";
import type { Paper } from "@/lib/types";
import { resolveAiSecrets, type CfEnv } from "@/server/env";
import type { StorageContext } from "@/server/storage/types";
import type { RetrievedChunk, RetrievalFilters } from "@/server/storage/types";
import { bm25Search, reciprocalRankFusion } from "./bm25";

const MAX_CONTEXT_CHARS = 2800;
const FINAL_K = 6;

export type RetrievalQuery = {
  text: string;
  paper?: Paper | null;
  topic?: string;
  documentIds?: string[];
  chapters?: string[];
};

export function buildRetrievalFilters(
  paper?: Paper | null,
  documentIds?: string[],
  chapters?: string[],
): RetrievalFilters {
  const filters: RetrievalFilters = {};
  if (paper) {
    filters.className = paper.className.replace(/\D/g, "") || paper.className;
    filters.subject = paper.subject;
  }
  if (documentIds?.length) filters.documentIds = documentIds;
  if (chapters?.length) filters.chapters = chapters;
  return filters;
}

export function buildRetrievalQuery(input: RetrievalQuery): string {
  const parts = [input.text];
  if (input.paper) {
    parts.push(input.paper.subject, ...input.paper.topics);
  }
  if (input.topic) parts.push(input.topic);
  return parts.filter(Boolean).join(" ");
}

export async function retrieve(
  storage: StorageContext,
  input: RetrievalQuery,
  cfEnv?: CfEnv,
): Promise<{ chunks: RetrievedChunk[]; contextBlock: string }> {
  const filters = buildRetrievalFilters(input.paper, input.documentIds, input.chapters);
  const query = buildRetrievalQuery(input);

  const { voyageApiKey } = resolveAiSecrets(cfEnv);
  const queryEmbedding = await embedQuery(query, { voyageApiKey, inputType: "query" });
  const [semanticResults, bm25Results] = await Promise.all([
    storage.vectors.search(queryEmbedding, filters, 12),
    bm25Search(storage, query, filters, 12),
  ]);

  const fused = reciprocalRankFusion([semanticResults, bm25Results], FINAL_K);
  const contextBlock = packContext(fused);
  return { chunks: fused, contextBlock };
}

function packContext(chunks: RetrievedChunk[]): string {
  let out = "";
  for (const c of chunks) {
    const cite = `[${c.documentId} · ${c.chapter} p.${c.page ?? "?"}]`;
    const block = `${cite}\n${c.text}\n\n`;
    if (out.length + block.length > MAX_CONTEXT_CHARS) break;
    out += block;
  }
  return (
    out.trim() ||
    "(No syllabus excerpts matched — verify admin has ingested books for this class and subject.)"
  );
}
