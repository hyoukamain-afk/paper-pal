/**
 * PostgreSQL adapter interface — production implementation would use Drizzle/Neon.
 * MVP uses in-memory store via createMemoryPostgres() in memory-store.ts.
 */
export type { PostgresAdapter } from "./types";
