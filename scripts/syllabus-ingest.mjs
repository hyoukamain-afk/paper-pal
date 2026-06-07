#!/usr/bin/env node
/**
 * Admin one-time syllabus ingest (not teacher-facing).
 * Supports NCERT PDFs or plain .txt — chunks + embeds into D1/Vectorize.
 *
 * Usage:
 *   ADMIN_SECRET=... npm run syllabus:ingest -- --url https://app.hyouka.in
 *
 * Put PDFs in data/books/ and set pdfFile in data/syllabus-manifest.json.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTextFromPdfBuffer } from "./pdf-extract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "data/syllabus-manifest.json");
const baseUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://127.0.0.1:8080";
const secret = process.env.ADMIN_SECRET;

if (!secret) {
  console.error("Set ADMIN_SECRET in the environment (see .env.example).");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

async function loadBookFromFolder(book) {
  const folderPath = join(root, book.pdfFolder);
  if (!existsSync(folderPath)) {
    throw new Error(`Folder not found: ${book.pdfFolder}`);
  }

  const exclude = new Set(book.exclude ?? []);
  const pdfs = readdirSync(folderPath)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .filter((f) => !exclude.has(f))
    .sort();

  if (pdfs.length === 0) {
    throw new Error(`No PDFs in ${book.pdfFolder}`);
  }

  console.log(`  Merging ${pdfs.length} chapter PDFs from ${book.pdfFolder}`);
  const parts = [];
  for (const pdf of pdfs) {
    const buffer = readFileSync(join(folderPath, pdf));
    const text = await extractTextFromPdfBuffer(buffer);
    parts.push(`\n\n===== ${pdf} =====\n\n${text}`);
    console.log(`    ✓ ${pdf} (${text.length.toLocaleString()} chars)`);
  }

  const text = parts.join("").trim();
  console.log(`  Combined ${text.length.toLocaleString()} characters`);
  return { text, filename: `${book.id}-chapters.txt`, source: "pdf-folder" };
}

async function loadBookText(book) {
  if (book.pdfFolder) {
    return loadBookFromFolder(book);
  }

  if (book.pdfFile) {
    const pdfPath = join(root, book.pdfFile);
    if (existsSync(pdfPath)) {
      console.log(`  Extracting text from PDF: ${book.pdfFile}`);
      const buffer = readFileSync(pdfPath);
      const text = await extractTextFromPdfBuffer(buffer);
      console.log(`  Extracted ${text.length.toLocaleString()} characters`);
      return { text, filename: book.pdfFile.split("/").pop(), source: "pdf" };
    }
    console.warn(`  PDF not found (${book.pdfFile}), falling back to textFile`);
  }

  if (book.textFile) {
    const textPath = join(root, book.textFile);
    return {
      text: readFileSync(textPath, "utf8"),
      filename: book.textFile.split("/").pop(),
      source: "txt",
    };
  }

  throw new Error(`Book ${book.id}: set pdfFolder, pdfFile, or textFile in syllabus-manifest.json`);
}

for (const book of manifest.books) {
  const { text, filename } = await loadBookText(book);
  const payload = {
    id: book.id,
    board: book.board,
    className: book.className,
    subject: book.subject,
    title: book.title,
    publisher: book.publisher,
    edition: book.edition,
    topics: book.topics,
    r2Key: book.r2Key,
    text,
    filename,
  };

  console.log(`Ingesting ${book.id}…`);
  const res = await fetch(`${baseUrl}/api/admin/syllabus/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": secret,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed ${book.id}:`, res.status, err);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`✓ ${book.id} — ${data.book.chunkCount} chunks indexed`);
}

console.log("\nDone. Books are in the syllabus catalog; teachers do not upload files.");
