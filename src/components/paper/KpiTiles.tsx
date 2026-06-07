import type { Paper } from "@/lib/types";

function totals(paper: Paper) {
  let marks = 0;
  let questions = 0;
  paper.sections.forEach((s) =>
    s.questions.forEach((q) => {
      marks += q.marks;
      questions += 1;
    }),
  );
  return { marks, questions };
}

const Tile = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-xl border bg-background p-3">
    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 text-xl font-semibold tracking-tight">{value}</div>
  </div>
);

export function KpiTiles({ paper }: { paper: Paper }) {
  const { marks, questions } = totals(paper);
  return (
    <div className="grid h-full grid-cols-2 gap-2.5">
      <Tile label="Total marks" value={marks} />
      <Tile label="Questions" value={questions} />
      <Tile label="Sections" value={paper.sections.length} />
      <Tile label="Difficulty" value={<span className="capitalize">{paper.difficulty}</span>} />
    </div>
  );
}
