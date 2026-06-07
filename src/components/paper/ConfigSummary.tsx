import type { Paper } from "@/lib/types";

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-right text-sm font-medium">{value}</span>
  </div>
);

export function ConfigSummary({ paper }: { paper: Paper }) {
  return (
    <div className="rounded-xl bg-surface/60 p-3.5">
      <div className="mb-1 text-xs font-medium text-muted-foreground">Configuration</div>
      <Row label="Class" value={paper.className} />
      <Row label="Subject" value={paper.subject} />
      <Row
        label="Topics"
        value={
          <span className="flex flex-wrap justify-end gap-1">
            {paper.topics.map((t) => (
              <span key={t} className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">
                {t}
              </span>
            ))}
          </span>
        }
      />
      <Row label="Sections" value={paper.sections.length} />
      <Row label="Difficulty" value={<span className="capitalize">{paper.difficulty}</span>} />
    </div>
  );
}
