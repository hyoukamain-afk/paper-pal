-- Syllabus catalog: admin-ingested books (not per-teacher uploads)

CREATE TABLE IF NOT EXISTS syllabus_books (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT,
  edition TEXT,
  topics_json TEXT NOT NULL DEFAULT '[]',
  document_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_syllabus_books_lookup
  ON syllabus_books (board, class_name, subject, status);

CREATE TABLE IF NOT EXISTS chunk_vectors (
  chunk_id TEXT PRIMARY KEY,
  embedding_json TEXT NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);
