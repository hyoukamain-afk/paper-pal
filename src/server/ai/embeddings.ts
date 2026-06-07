/** Must match Voyage model dimensions (voyage-3-lite = 512). */
export const EMBED_DIM = 512;
export const VOYAGE_EMBED_MODEL = "voyage-3-lite";
const VOYAGE_API = "https://api.voyageai.com/v1/embeddings";

export type EmbedOptions = {
  voyageApiKey?: string;
  inputType?: "query" | "document";
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Deterministic local embedding for dev when Voyage API key is unavailable. */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  for (const token of tokenize(text)) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (h * 31 + token.charCodeAt(i)) >>> 0;
    }
    const idx = h % EMBED_DIM;
    vec[idx] += 1;
    vec[(idx + 17) % EMBED_DIM] += 0.5;
  }
  return normalize(vec);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i]! * b[i]!;
  return dot;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Free Voyage tier is ~3 RPM — pause between batch calls during bulk ingest. */
const VOYAGE_BATCH_DELAY_MS = 21_000;
const VOYAGE_MAX_RETRIES = 5;

async function voyageEmbed(
  texts: string[],
  apiKey: string,
  inputType: "query" | "document",
): Promise<number[][]> {
  let lastErr = "Voyage API error";

  for (let attempt = 0; attempt < VOYAGE_MAX_RETRIES; attempt++) {
    const response = await fetch(VOYAGE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: VOYAGE_EMBED_MODEL,
        input_type: inputType,
      }),
    });

    if (response.status === 429) {
      const err = await response.text();
      lastErr = `Voyage API error 429: ${err.slice(0, 300)}`;
      const waitMs = VOYAGE_BATCH_DELAY_MS * (attempt + 1);
      console.warn(`Voyage rate limit — waiting ${Math.round(waitMs / 1000)}s before retry…`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Voyage API error ${response.status}: ${err.slice(0, 300)}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    if (!data.data?.length) throw new Error("Voyage API returned no embeddings");

    return data.data.map((row) => normalize(row.embedding));
  }

  throw new Error(lastErr);
}

const VOYAGE_BATCH_SIZE = 32;

export async function embedTexts(texts: string[], opts?: EmbedOptions): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (opts?.voyageApiKey) {
    const out: number[][] = [];
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
      batches.push(texts.slice(i, i + VOYAGE_BATCH_SIZE));
    }

    for (let b = 0; b < batches.length; b++) {
      if (b > 0) await sleep(VOYAGE_BATCH_DELAY_MS);
      const vecs = await voyageEmbed(batches[b]!, opts.voyageApiKey, opts.inputType ?? "document");
      out.push(...vecs);
    }
    return out;
  }

  return texts.map(localEmbed);
}

export async function embedQuery(text: string, opts?: EmbedOptions): Promise<number[]> {
  const [vec] = await embedTexts([text], { ...opts, inputType: "query" });
  return vec ?? localEmbed(text);
}
