import { extractText, getDocumentProxy } from "unpdf";

/** Extract plain text from a PDF buffer (NCERT books, admin ingest only). */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(pdfBytes);
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
