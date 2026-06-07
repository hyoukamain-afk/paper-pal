import { ingestDocument } from "@/server/ai/rag/ingest";
import type { CfEnv } from "@/server/env";
import type { QueuePayload } from "@/server/storage/cf-queue";
import { getStorage } from "@/server/storage";

export async function processQueueBatch(batch: MessageBatch<QueuePayload>, env: CfEnv): Promise<void> {
  const storage = getStorage(env);

  for (const message of batch.messages) {
    try {
      const body = message.body;
      if (body.type === "ingest_document") {
        const { documentId, className, subject, filename, text, r2Key } = body.payload;
        let content = text ?? "";

        if (!content && r2Key && env.SYLLABUS_BUCKET) {
          const obj = await env.SYLLABUS_BUCKET.get(r2Key);
          if (obj) content = await obj.text();
        }

        if (!content) {
          console.error("Ingest: no text for document", documentId);
          message.ack();
          continue;
        }

        await ingestDocument(storage, {
          documentId,
          text: content,
          className,
          subject,
          filename,
        });
      }

      if (body.type === "generate_paper") {
        // Reserved for async full-paper jobs
        console.log("generate_paper job received", body.payload);
      }

      message.ack();
    } catch (err) {
      console.error("Queue message failed", err);
      message.retry();
    }
  }
}
