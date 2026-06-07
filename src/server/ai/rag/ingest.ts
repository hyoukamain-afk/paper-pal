import type { StorageContext } from "@/server/storage/types";
import type { SyllabusChunk } from "@/server/storage/types";
import { ingestCatalogBook } from "./catalog-ingest";

const CHUNK_TARGET = 500;
const OVERLAP = 80;

function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (current.length + p.length > CHUNK_TARGET && current.length > 0) {
      chunks.push(current.trim());
      const tail = current.slice(-OVERLAP);
      current = tail + "\n\n" + p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, CHUNK_TARGET)];
}

function detectChapter(text: string): string {
  const match = text.match(/chapter\s+(\d+|[IVXLC]+)/i);
  return match ? `Chapter ${match[1]}` : "General";
}

export async function ingestDocument(
  storage: StorageContext,
  payload: {
    documentId: string;
    text: string;
    className: string;
    subject: string;
    filename: string;
  },
): Promise<void> {
  const doc = await storage.postgres.getDocument(payload.documentId);
  if (!doc) return;

  const parts = chunkText(payload.text);
  const chunks: SyllabusChunk[] = parts.map((text, i) => ({
    id: `${payload.documentId}_c${i}`,
    documentId: payload.documentId,
    text,
    className: payload.className,
    subject: payload.subject,
    chapter: detectChapter(text),
    page: i + 1,
    topicTags: [],
  }));

  await storage.postgres.saveChunks(chunks);
  await storage.search.indexChunks(chunks, doc.syllabusVersion);

  await storage.postgres.saveDocument({
    ...doc,
    status: "indexed",
  });
}

const DEFAULT_BOOK_TEXT = `
Chapter 12 Electricity

Ohm's law states that the potential difference V across a conductor is proportional to current I through it: V = IR.
Resistance depends on resistivity ρ, length L and area A: R = ρL/A.

Heating effect of electric current: H = I²Rt = VIt joules.

Chapter 13 Magnetic Effects of Electric Current

A current-carrying conductor produces a magnetic field around it. Fleming's left-hand rule gives direction of force on a conductor in a magnetic field.

An electric motor converts electrical energy to mechanical energy using the motor effect.

Chapter 14 Sources of Energy

Renewable sources include solar, wind, hydro. Non-renewable include coal and petroleum.
`;

/** Seed default catalog book for local dev (admin-equivalent one-time ingest). */
export async function seedDefaultSyllabus(storage: StorageContext): Promise<void> {
  const bookId = "ncert-10-physics";
  const existing = await storage.postgres.getBook(bookId);
  if (existing?.status === "indexed") return;

  await ingestCatalogBook(storage, {
    id: bookId,
    board: "CBSE",
    className: "10",
    subject: "Physics",
    title: "NCERT Science — Physics (Class 10 excerpt)",
    publisher: "NCERT",
    topics: ["Electricity", "Magnetic Effects of Electric Current", "Sources of Energy"],
    r2Key: "books/cbse/10/physics/ncert-10-physics.txt",
    text: DEFAULT_BOOK_TEXT,
    filename: "ncert-10-physics.txt",
  });
}
