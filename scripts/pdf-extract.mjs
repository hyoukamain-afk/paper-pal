import { extractText, getDocumentProxy } from "unpdf";

/** Node-side PDF extraction for syllabus:ingest CLI. */
export async function extractTextFromPdfBuffer(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
  const cleaned = merged
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < 50) {
    throw new Error(
      "PDF yielded very little text — it may be scanned/image-only. Use a text-based PDF or OCR first.",
    );
  }

  return cleaned;
}
