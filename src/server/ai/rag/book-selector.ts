import type { SyllabusSource } from "@/lib/types";
import type { StorageContext, SyllabusBook } from "@/server/storage/types";
import type { PaperIntent } from "./intent";

export type BookSelection = {
  books: SyllabusBook[];
  documentIds: string[];
  chapters: string[];
  sources: SyllabusSource[];
};

function topicOverlap(bookTopics: string[], requested: string[]): number {
  if (requested.length === 0) return 0;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bookSet = new Set(bookTopics.map(norm));
  let hits = 0;
  for (const t of requested) {
    const n = norm(t);
    if ([...bookSet].some((b) => b.includes(n) || n.includes(b))) hits++;
  }
  return hits;
}

const SST_SUBJECTS = new Set(["geography", "economics", "history", "politicalscience"]);

function isSocialScienceIntent(subject: string): boolean {
  const n = subject.toLowerCase().replace(/[^a-z]/g, "");
  return n === "socialscience" || n === "sst";
}

export async function selectSyllabusBooks(
  storage: StorageContext,
  intent: PaperIntent,
): Promise<BookSelection> {
  let candidates = await storage.postgres.listBooks({
    board: intent.board,
    className: intent.className,
    subject: intent.subject,
    status: "indexed",
  });

  if (candidates.length === 0 && isSocialScienceIntent(intent.subject)) {
    const allClass = await storage.postgres.listBooks({
      board: intent.board,
      className: intent.className,
      status: "indexed",
    });
    candidates = allClass.filter((b) =>
      SST_SUBJECTS.has(b.subject.toLowerCase().replace(/[^a-z]/g, "")),
    );
  }

  if (candidates.length === 0) {
    return { books: [], documentIds: [], chapters: [], sources: [] };
  }

  const ranked = candidates
    .map((book) => ({
      book,
      score: topicOverlap(book.topics, intent.topics) + (book.title.length > 0 ? 0.1 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const limit = isSocialScienceIntent(intent.subject) ? 4 : 2;
  const selected = ranked.slice(0, limit).map((r) => r.book);
  const documentIds = selected.map((b) => b.documentId);

  const chapters = intent.topics.length > 0 ? intent.topics : selected.flatMap((b) => b.topics).slice(0, 4);

  const sources: SyllabusSource[] = selected.map((book) => ({
    bookId: book.id,
    title: book.title,
    board: book.board,
    chapters: chapters.slice(0, 6),
  }));

  return { books: selected, documentIds, chapters, sources };
}
