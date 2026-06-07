import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Difficulty, Paper } from "@/lib/types";
import { usePaperStore } from "@/store/paperStore";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const diffs: Difficulty[] = ["easy", "medium", "hard"];
const TOPIC_VARS = ["--topic-1", "--topic-2", "--topic-3", "--topic-4", "--topic-5"];

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/40 bg-white/50 px-3 py-1.5 backdrop-blur">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-semibold tabular-nums">{value}</span>
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function PaperOverview({ paper }: { paper: Paper }) {
  const applyOverallDifficulty = usePaperStore((s) => s.applyOverallDifficulty);

  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const [applyingDifficulty, setApplyingDifficulty] = useState(false);

  const totals = useMemo(() => {
    let q = 0;
    let m = 0;
    paper.sections.forEach((s) => s.questions.forEach((qq) => { q += 1; m += qq.marks; }));
    return { q, m };
  }, [paper]);

  const donutData = useMemo(() => {
    const map = new Map<string, number>();
    paper.sections.forEach((sec) =>
      sec.questions.forEach((q) => map.set(q.topic, (map.get(q.topic) ?? 0) + q.marks)),
    );
    return [...map.entries()].map(([topic, marks], i) => ({
      topic,
      marks,
      color: `var(${TOPIC_VARS[i % TOPIC_VARS.length]})`,
    }));
  }, [paper]);

  const topicBreakdown = useMemo(() => {
    const total = totals.m || 1;
    return donutData.map((d) => ({
      ...d,
      pct: Math.round((d.marks / total) * 100),
    }));
  }, [donutData, totals.m]);

  const handleConfirmDifficulty = async () => {
    if (!pendingDifficulty) return;
    setApplyingDifficulty(true);
    await applyOverallDifficulty(pendingDifficulty);
    setApplyingDifficulty(false);
    setPendingDifficulty(null);
  };

  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Paper overview</h2>
          <p className="text-[11px] text-muted-foreground">
            {paper.className} · {paper.subject}
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-white/40 bg-white/50 p-0.5 backdrop-blur">
          {diffs.map((d) => (
            <button
              key={d}
              onClick={() => {
                if (paper.difficulty === d) return;
                setPendingDifficulty(d);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                paper.difficulty === d
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={paper.difficulty === d ? { backgroundColor: "#036e36" } : undefined}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground">
        To change marks, sections, or question counts, ask the copilot.
      </p>

      <AlertDialog
        open={pendingDifficulty !== null}
        onOpenChange={(open) => {
          if (!open && !applyingDifficulty) setPendingDifficulty(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change paper difficulty?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to <strong className="capitalize">{pendingDifficulty}</strong> will
              regenerate every question in this paper to match the new difficulty level. This may
              take a minute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyingDifficulty}>Cancel</AlertDialogCancel>
            <Button onClick={() => void handleConfirmDifficulty()} disabled={applyingDifficulty}>
              {applyingDifficulty ? "Updating…" : "Update whole paper"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total marks" value={totals.m} suffix="marks" />
        <Stat label="Time" value={paper.durationMinutes} suffix="min" />
        <Stat label="Questions" value={totals.q} suffix="total" />
        <Stat label="Sections" value={paper.sections.length} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Sections
          </div>
          <div className="overflow-hidden rounded-xl border border-white/40 bg-white/40 backdrop-blur">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2.5 py-1.5 text-left font-medium">Section</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Questions</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Marks</th>
                </tr>
              </thead>
              <tbody>
                {paper.sections.map((sec) => (
                  <tr key={sec.id} className="border-b border-white/30 last:border-b-0">
                    <td className="px-2.5 py-1.5 font-serif text-[13px]">{sec.title}</td>
                    <td className="px-2.5 py-1.5 text-right text-[13px] tabular-nums text-muted-foreground">
                      {sec.questions.length}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-[13px] font-medium tabular-nums">
                      {sec.questions.reduce((acc, q) => acc + q.marks, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Marks by topic
          </div>
          <div className="rounded-xl border border-white/40 bg-white/40 p-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-3">
              <div className="relative h-[72px] w-[72px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="marks"
                      innerRadius={22}
                      outerRadius={34}
                      stroke="white"
                      strokeWidth={2}
                      paddingAngle={2}
                    >
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-[10px] font-semibold tabular-nums">{totals.m}m</div>
                </div>
              </div>
              <div className="flex-1 text-[11px] text-muted-foreground">
                Share of marks per topic in this draft.
              </div>
            </div>
            <div className="space-y-1">
              {topicBreakdown.map((row) => (
                <div key={row.topic} className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: row.color }}
                  />
                  <span className="flex-1 truncate text-[12px] font-medium">{row.topic}</span>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {row.marks}m
                  </span>
                  <span className="w-8 text-right text-[12px] tabular-nums font-medium">
                    {row.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
