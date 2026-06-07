import type { RetrievedChunk, SearchAdapter } from "./types";

/** D1 FTS5 lexical search (BM25 ranking via bm25() helper). */
export function createD1Search(db: D1Database): SearchAdapter {
  return {
    async indexChunks(_chunks, _syllabusVersion) {
      // FTS rows are written in createD1Postgres.saveChunks
    },

    async search(query, filters, k) {
      const terms = query
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 1)
        .map((t) => `"${t.replace(/"/g, "")}"`)
        .join(" ");
      if (!terms) return [];

      let sql = `
        SELECT
          c.id,
          c.document_id,
          c.text,
          c.class_name,
          c.subject,
          c.chapter,
          c.page,
          c.topic_tags_json,
          bm25(chunks_fts) AS score
        FROM chunks_fts
        JOIN chunks c ON c.id = chunks_fts.chunk_id
        WHERE chunks_fts MATCH ?
      `;
      const binds: (string | number)[] = [terms];

      if (filters.className) {
        sql += ` AND c.class_name = ?`;
        binds.push(filters.className);
      }
      if (filters.subject) {
        sql += ` AND c.subject = ?`;
        binds.push(filters.subject);
      }
      if (filters.chapter) {
        sql += ` AND c.chapter = ?`;
        binds.push(filters.chapter);
      }
      if (filters.documentIds?.length) {
        sql += ` AND c.document_id IN (${filters.documentIds.map(() => "?").join(",")})`;
        binds.push(...filters.documentIds);
      }
      if (filters.chapters?.length) {
        const parts = filters.chapters.map(() => `c.chapter LIKE ?`);
        sql += ` AND (${parts.join(" OR ")})`;
        binds.push(...filters.chapters.map((c) => `%${c}%`));
      }

      sql += ` ORDER BY score LIMIT ?`;
      binds.push(k);

      const { results } = await db
        .prepare(sql)
        .bind(...binds)
        .all<{
          id: string;
          document_id: string;
          text: string;
          class_name: string;
          subject: string;
          chapter: string;
          page: number | null;
          topic_tags_json: string;
          score: number;
        }>();

      return (results ?? []).map(
        (row): RetrievedChunk => ({
          id: row.id,
          documentId: row.document_id,
          text: row.text,
          className: row.class_name,
          subject: row.subject,
          chapter: row.chapter,
          page: row.page ?? undefined,
          topicTags: JSON.parse(row.topic_tags_json) as string[],
          score: Math.abs(row.score),
        }),
      );
    },
  };
}
