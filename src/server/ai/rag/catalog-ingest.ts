import { embedTexts } from "@/server/ai/embeddings";
import { ingestDocument } from "@/server/ai/rag/ingest";
import { resolveAiSecrets, type CfEnv } from "@/server/env";
import type { StorageContext, SyllabusBook } from "@/server/storage/types";

export type IngestBookInput = {
  id: string;
  board: string;
  className: string;
  subject: string;
  title: string;
  publisher?: string;
  edition?: string;
  topics: string[];
  r2Key: string;
  text: string;
  filename?: string;
};

/** Admin one-time ingest: chunk → embed once → store semantic vectors + FTS. */
export async function ingestCatalogBook(
  storage: StorageContext,
  input: IngestBookInput,
  cfEnv?: CfEnv,
): Promise<SyllabusBook> {
  const now = new Date().toISOString();
  const documentId = `doc_${input.id}`;
  const filename = input.filename ?? `${input.id}.txt`;

  await storage.postgres.saveBook({
    id: input.id,
    board: input.board,
    className: input.className,
    subject: input.subject,
    title: input.title,
    publisher: input.publisher,
    edition: input.edition,
    topics: input.topics,
    documentId,
    r2Key: input.r2Key,
    status: "draft",
    chunkCount: 0,
    createdAt: now,
  });

  await storage.postgres.saveDocument({
    id: documentId,
    sessionId: "system",
    bookId: input.id,
    filename,
    className: input.className,
    subject: input.subject,
    status: "pending",
    syllabusVersion: 1,
    r2Key: input.r2Key,
    createdAt: now,
  });

  await ingestDocument(storage, {
    documentId,
    text: input.text,
    className: input.className,
    subject: input.subject,
    filename,
  });

  const chunks = await storage.postgres.listChunks({ documentIds: [documentId] });
  const { voyageApiKey } = resolveAiSecrets(cfEnv);
  const texts = chunks.map((c) => c.text);
  const embeddings = await embedTexts(texts, {
    voyageApiKey,
    inputType: "document",
  });

  const VECTOR_UPSERT_BATCH = 50;
  const vectors = chunks.map((chunk, i) => ({
    chunkId: chunk.id,
    embedding: embeddings[i] ?? [],
  }));
  for (let i = 0; i < vectors.length; i += VECTOR_UPSERT_BATCH) {
    await storage.vectors.upsert(vectors.slice(i, i + VECTOR_UPSERT_BATCH));
  }

  const book: SyllabusBook = {
    id: input.id,
    board: input.board,
    className: input.className,
    subject: input.subject,
    title: input.title,
    publisher: input.publisher,
    edition: input.edition,
    topics: input.topics,
    documentId,
    r2Key: input.r2Key,
    status: "indexed",
    chunkCount: chunks.length,
    createdAt: now,
  };

  await storage.postgres.saveBook(book);
  return book;
}
