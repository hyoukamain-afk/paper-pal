import type { Paper } from "@/lib/types";
import type {
  ChatMessageRecord,
  LlmJobRecord,
  PostgresAdapter,
  ChunkVector,
  SyllabusBook,
  SyllabusChunk,
  SyllabusDocument,
} from "./types";

/** Cloudflare D1 allows at most 100 statements per batch. */
const D1_BATCH_LIMIT = 100;

async function runD1Batches(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += D1_BATCH_LIMIT) {
    await db.batch(stmts.slice(i, i + D1_BATCH_LIMIT));
  }
}

export function createD1Postgres(db: D1Database): PostgresAdapter {
  return {
    async savePaper(record) {
      await db
        .prepare(
          `INSERT INTO papers (id, session_id, user_id, version, data_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             session_id = excluded.session_id,
             user_id = excluded.user_id,
             version = excluded.version,
             data_json = excluded.data_json,
             updated_at = excluded.updated_at`,
        )
        .bind(
          record.id,
          record.sessionId,
          record.userId ?? null,
          record.version,
          JSON.stringify(record.data),
          record.updatedAt,
        )
        .run();
    },

    async getPaper(id) {
      const row = await db
        .prepare(`SELECT id, session_id, user_id, version, data_json, updated_at FROM papers WHERE id = ?`)
        .bind(id)
        .first<{
          id: string;
          session_id: string;
          user_id: string | null;
          version: number;
          data_json: string;
          updated_at: string;
        }>();
      if (!row) return null;
      return {
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id ?? undefined,
        version: row.version,
        data: JSON.parse(row.data_json) as Paper,
        updatedAt: row.updated_at,
      };
    },

    async listPapersBySession(sessionId) {
      const { results } = await db
        .prepare(
          `SELECT id, session_id, user_id, version, data_json, updated_at FROM papers WHERE session_id = ? ORDER BY updated_at DESC`,
        )
        .bind(sessionId)
        .all<{
          id: string;
          session_id: string;
          user_id: string | null;
          version: number;
          data_json: string;
          updated_at: string;
        }>();
      return (results ?? []).map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id ?? undefined,
        version: row.version,
        data: JSON.parse(row.data_json) as Paper,
        updatedAt: row.updated_at,
      }));
    },

    async saveChatMessage(msg) {
      await db
        .prepare(
          `INSERT INTO chat_messages (id, session_id, paper_id, role, content, state, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET content = excluded.content, state = excluded.state`,
        )
        .bind(
          msg.id,
          msg.sessionId,
          msg.paperId ?? null,
          msg.role,
          msg.content,
          msg.state ?? null,
          msg.createdAt,
        )
        .run();
    },

    async listChatMessages(sessionId, paperId) {
      const sql = paperId
        ? `SELECT id, session_id, paper_id, role, content, state, created_at FROM chat_messages WHERE session_id = ? AND paper_id = ? ORDER BY created_at ASC`
        : `SELECT id, session_id, paper_id, role, content, state, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`;
      const stmt = db.prepare(sql).bind(...(paperId ? [sessionId, paperId] : [sessionId]));
      const { results } = await stmt.all<{
        id: string;
        session_id: string;
        paper_id: string | null;
        role: string;
        content: string;
        state: string | null;
        created_at: string;
      }>();
      return (results ?? []).map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        paperId: row.paper_id ?? undefined,
        role: row.role as "user" | "assistant",
        content: row.content,
        state: row.state ?? undefined,
        createdAt: row.created_at,
      }));
    },

    async createJob(job) {
      await db
        .prepare(
          `INSERT INTO llm_jobs (id, task_type, status, input_hash, output_json, error, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          job.id,
          job.taskType,
          job.status,
          job.inputHash,
          job.outputJson ? JSON.stringify(job.outputJson) : null,
          job.error ?? null,
          job.createdAt,
          job.updatedAt,
        )
        .run();
    },

    async updateJob(id, patch) {
      const cur = await this.getJob(id);
      if (!cur) return;
      const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
      await db
        .prepare(
          `UPDATE llm_jobs SET task_type = ?, status = ?, input_hash = ?, output_json = ?, error = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(
          next.taskType,
          next.status,
          next.inputHash,
          next.outputJson ? JSON.stringify(next.outputJson) : null,
          next.error ?? null,
          next.updatedAt,
          id,
        )
        .run();
    },

    async getJob(id) {
      const row = await db
        .prepare(
          `SELECT id, task_type, status, input_hash, output_json, error, created_at, updated_at FROM llm_jobs WHERE id = ?`,
        )
        .bind(id)
        .first<{
          id: string;
          task_type: string;
          status: string;
          input_hash: string;
          output_json: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        }>();
      if (!row) return null;
      return {
        id: row.id,
        taskType: row.task_type,
        status: row.status as LlmJobRecord["status"],
        inputHash: row.input_hash,
        outputJson: row.output_json ? JSON.parse(row.output_json) : undefined,
        error: row.error ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    async saveDocument(doc) {
      const r2Key = doc.r2Key;
      await db
        .prepare(
          `INSERT INTO syllabus_documents (id, session_id, filename, class_name, subject, status, syllabus_version, r2_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             syllabus_version = excluded.syllabus_version,
             r2_key = COALESCE(excluded.r2_key, r2_key)`,
        )
        .bind(
          doc.id,
          doc.sessionId,
          doc.filename,
          doc.className,
          doc.subject,
          doc.status,
          doc.syllabusVersion,
          r2Key ?? null,
          doc.createdAt,
        )
        .run();
    },

    async getDocument(id) {
      const row = await db
        .prepare(
          `SELECT id, session_id, filename, class_name, subject, status, syllabus_version, r2_key, created_at FROM syllabus_documents WHERE id = ?`,
        )
        .bind(id)
        .first<{
          id: string;
          session_id: string;
          filename: string;
          class_name: string;
          subject: string;
          status: string;
          syllabus_version: number;
          r2_key: string | null;
          created_at: string;
        }>();
      if (!row) return null;
      return {
        id: row.id,
        sessionId: row.session_id,
        filename: row.filename,
        className: row.class_name,
        subject: row.subject,
        status: row.status as SyllabusDocument["status"],
        syllabusVersion: row.syllabus_version,
        createdAt: row.created_at,
        r2Key: row.r2_key ?? undefined,
      };
    },

    async saveChunks(newChunks) {
      const stmts = newChunks.flatMap((c) => {
        const topicTags = JSON.stringify(c.topicTags ?? []);
        return [
          db
            .prepare(
              `INSERT INTO chunks (id, document_id, text, class_name, subject, chapter, page, topic_tags_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET text = excluded.text`,
            )
            .bind(
              c.id,
              c.documentId,
              c.text,
              c.className,
              c.subject,
              c.chapter,
              c.page ?? null,
              topicTags,
            ),
          db
            .prepare(
              `INSERT INTO chunks_fts (chunk_id, document_id, class_name, subject, chapter, content)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(c.id, c.documentId, c.className, c.subject, c.chapter, c.text),
        ];
      });
      if (stmts.length > 0) await runD1Batches(db, stmts);
    },

    async listChunks(filters) {
      let sql = `SELECT id, document_id, text, class_name, subject, chapter, page, topic_tags_json FROM chunks WHERE 1=1`;
      const binds: string[] = [];
      if (filters.className) {
        sql += ` AND class_name = ?`;
        binds.push(filters.className);
      }
      if (filters.subject) {
        sql += ` AND subject = ?`;
        binds.push(filters.subject);
      }
      if (filters.chapter) {
        sql += ` AND chapter = ?`;
        binds.push(filters.chapter);
      }
      if (filters.documentIds?.length) {
        sql += ` AND document_id IN (${filters.documentIds.map(() => "?").join(",")})`;
        binds.push(...filters.documentIds);
      }
      if (filters.chapters?.length) {
        const parts = filters.chapters.map(() => `chapter LIKE ?`);
        sql += ` AND (${parts.join(" OR ")})`;
        binds.push(...filters.chapters.map((c) => `%${c}%`));
      }
      const stmt = db.prepare(sql);
      const { results } = await (binds.length ? stmt.bind(...binds) : stmt).all<{
        id: string;
        document_id: string;
        text: string;
        class_name: string;
        subject: string;
        chapter: string;
        page: number | null;
        topic_tags_json: string;
      }>();
      return (results ?? []).map(
        (row): SyllabusChunk => ({
          id: row.id,
          documentId: row.document_id,
          text: row.text,
          className: row.class_name,
          subject: row.subject,
          chapter: row.chapter,
          page: row.page ?? undefined,
          topicTags: JSON.parse(row.topic_tags_json) as string[],
        }),
      );
    },

    async saveBook(book) {
      await db
        .prepare(
          `INSERT INTO syllabus_books (id, board, class_name, subject, title, publisher, edition, topics_json, document_id, r2_key, status, chunk_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             status = excluded.status,
             chunk_count = excluded.chunk_count,
             topics_json = excluded.topics_json`,
        )
        .bind(
          book.id,
          book.board,
          book.className,
          book.subject,
          book.title,
          book.publisher ?? null,
          book.edition ?? null,
          JSON.stringify(book.topics),
          book.documentId,
          book.r2Key,
          book.status,
          book.chunkCount,
          book.createdAt,
        )
        .run();
    },

    async getBook(id) {
      const row = await db
        .prepare(
          `SELECT id, board, class_name, subject, title, publisher, edition, topics_json, document_id, r2_key, status, chunk_count, created_at FROM syllabus_books WHERE id = ?`,
        )
        .bind(id)
        .first<{
          id: string;
          board: string;
          class_name: string;
          subject: string;
          title: string;
          publisher: string | null;
          edition: string | null;
          topics_json: string;
          document_id: string;
          r2_key: string;
          status: string;
          chunk_count: number;
          created_at: string;
        }>();
      if (!row) return null;
      return {
        id: row.id,
        board: row.board,
        className: row.class_name,
        subject: row.subject,
        title: row.title,
        publisher: row.publisher ?? undefined,
        edition: row.edition ?? undefined,
        topics: JSON.parse(row.topics_json) as string[],
        documentId: row.document_id,
        r2Key: row.r2_key,
        status: row.status as SyllabusBook["status"],
        chunkCount: row.chunk_count,
        createdAt: row.created_at,
      };
    },

    async listBooks(filters) {
      let sql = `SELECT id, board, class_name, subject, title, publisher, edition, topics_json, document_id, r2_key, status, chunk_count, created_at FROM syllabus_books WHERE 1=1`;
      const binds: string[] = [];
      if (filters.board) {
        sql += ` AND board = ?`;
        binds.push(filters.board);
      }
      if (filters.className) {
        sql += ` AND class_name = ?`;
        binds.push(filters.className);
      }
      if (filters.subject) {
        sql += ` AND subject = ?`;
        binds.push(filters.subject);
      }
      if (filters.status) {
        sql += ` AND status = ?`;
        binds.push(filters.status);
      }
      const { results } = await db
        .prepare(sql)
        .bind(...binds)
        .all<{
          id: string;
          board: string;
          class_name: string;
          subject: string;
          title: string;
          publisher: string | null;
          edition: string | null;
          topics_json: string;
          document_id: string;
          r2_key: string;
          status: string;
          chunk_count: number;
          created_at: string;
        }>();
      return (results ?? []).map(
        (row): SyllabusBook => ({
          id: row.id,
          board: row.board,
          className: row.class_name,
          subject: row.subject,
          title: row.title,
          publisher: row.publisher ?? undefined,
          edition: row.edition ?? undefined,
          topics: JSON.parse(row.topics_json) as string[],
          documentId: row.document_id,
          r2Key: row.r2_key,
          status: row.status as SyllabusBook["status"],
          chunkCount: row.chunk_count,
          createdAt: row.created_at,
        }),
      );
    },

    async saveChunkVectors(vectors) {
      const stmts = vectors.map((v) =>
        db
          .prepare(
            `INSERT INTO chunk_vectors (chunk_id, embedding_json) VALUES (?, ?)
             ON CONFLICT(chunk_id) DO UPDATE SET embedding_json = excluded.embedding_json`,
          )
          .bind(v.chunkId, JSON.stringify(v.embedding)),
      );
      if (stmts.length > 0) await runD1Batches(db, stmts);
    },

    async listChunkVectors(chunkIds) {
      if (chunkIds.length === 0) return [];
      const { results } = await db
        .prepare(
          `SELECT chunk_id, embedding_json FROM chunk_vectors WHERE chunk_id IN (${chunkIds.map(() => "?").join(",")})`,
        )
        .bind(...chunkIds)
        .all<{ chunk_id: string; embedding_json: string }>();
      return (results ?? []).map(
        (row): ChunkVector => ({
          chunkId: row.chunk_id,
          embedding: JSON.parse(row.embedding_json) as number[],
        }),
      );
    },
  };
}
