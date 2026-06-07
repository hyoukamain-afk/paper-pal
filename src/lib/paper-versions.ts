import type { Paper } from "@/lib/types";
import type { PaperVersion } from "@/lib/types";

export const MAX_PAPER_VERSIONS = 30;

let vid = 0;
export function newVersionId(): string {
  return `pv_${Date.now().toString(36)}_${(vid++).toString(36)}`;
}

export function pushPaperVersion(
  versions: PaperVersion[],
  paper: Paper,
  label: string,
  source: PaperVersion["source"],
): PaperVersion[] {
  const entry: PaperVersion = {
    id: newVersionId(),
    paper: structuredClone(paper),
    createdAt: new Date().toISOString(),
    label: label.slice(0, 120),
    source,
  };
  const next = [...versions, entry];
  if (next.length > MAX_PAPER_VERSIONS) return next.slice(-MAX_PAPER_VERSIONS);
  return next;
}

/** Restore paper from N steps back (1 = most recent saved snapshot). */
export function revertPaperVersions(
  versions: PaperVersion[],
  steps: number,
): { paper: Paper | null; versions: PaperVersion[] } {
  const n = Math.min(Math.max(1, Math.floor(steps)), versions.length);
  if (n === 0) return { paper: null, versions };
  const target = versions[versions.length - n]!;
  const remaining = versions.slice(0, versions.length - n);
  return {
    paper: structuredClone(target.paper),
    versions: remaining,
  };
}

export function formatVersionHistoryForPrompt(versions: PaperVersion[]): string {
  if (versions.length === 0) return "(no version history yet)";
  const recent = versions.slice(-8);
  return recent
    .map((v, i) => {
      const stepsBack = recent.length - i;
      return `- ${stepsBack} step(s) back: "${v.label}"`;
    })
    .join("\n");
}
