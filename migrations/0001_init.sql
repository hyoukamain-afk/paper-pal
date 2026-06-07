-- Paperly D1 schema (source of truth)

CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_papers_session ON papers(session_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  paper_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  state TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS llm_jobs (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS syllabus_documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  syllabus_version INTEGER NOT NULL DEFAULT 1,
  r2_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  text TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  page INTEGER,
  topic_tags_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (document_id) REFERENCES syllabus_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_meta ON chunks(class_name, subject);

-- FTS5 for BM25-style lexical search
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED,
  document_id UNINDEXED,
  class_name,
  subject,
  chapter UNINDEXED,
  content,
  tokenize = 'porter unicode61'
);
