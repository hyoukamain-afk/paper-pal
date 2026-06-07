import type { QueueAdapter } from "./types";

export type IngestQueuePayload = {
  type: "ingest_document";
  payload: {
    documentId: string;
    className: string;
    subject: string;
    filename: string;
    text?: string;
    r2Key?: string;
  };
};

export type PaperQueuePayload = {
  type: "generate_paper";
  payload: Record<string, unknown>;
};

export type QueuePayload = IngestQueuePayload | PaperQueuePayload;

export function createCfQueueProducer(queue: Queue<QueuePayload>): QueueAdapter {
  return {
    async enqueue(msg) {
      const id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await queue.send(msg as QueuePayload);
      return id;
    },
    async processNext() {
      // Handled by Worker `queue` export
    },
  };
}
