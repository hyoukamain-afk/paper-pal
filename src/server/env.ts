/** Cloudflare Worker bindings — keep in sync with wrangler.jsonc */
export type CfEnv = {
  DB: D1Database;
  CACHE: KVNamespace;
  SYLLABUS_BUCKET?: R2Bucket;
  INGEST_QUEUE: Queue;
  SYLLABUS_VECTORS?: VectorizeIndex;
  ANTHROPIC_API_KEY?: string;
  VOYAGE_API_KEY?: string;
  ADMIN_SECRET?: string;
};

export type AiSecrets = {
  anthropicApiKey?: string;
  voyageApiKey?: string;
};

export function hasCloudflareBindings(env: unknown): env is CfEnv {
  if (!env || typeof env !== "object") return false;
  const e = env as Record<string, unknown>;
  const db = e.DB as D1Database | undefined;
  return db != null && typeof db.prepare === "function";
}

/** Merge Worker secrets with process.env for local Vite dev. */
export function resolveAiSecrets(cfEnv?: CfEnv): AiSecrets {
  const fromProcess =
    typeof process !== "undefined" && process.env
      ? {
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          voyageApiKey: process.env.VOYAGE_API_KEY,
        }
      : {};

  return {
    anthropicApiKey: cfEnv?.ANTHROPIC_API_KEY ?? fromProcess.anthropicApiKey,
    voyageApiKey: cfEnv?.VOYAGE_API_KEY ?? fromProcess.voyageApiKey,
  };
}

export function resolveAdminSecret(cfEnv?: CfEnv): string {
  return (
    cfEnv?.ADMIN_SECRET ??
    (typeof process !== "undefined" ? process.env.ADMIN_SECRET : undefined) ??
    "local-dev-admin-change-me"
  );
}
