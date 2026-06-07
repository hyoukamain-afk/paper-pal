import { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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
  onChange,
  suffix,
  editable = true,
  min = 1,
  max = 999,
}: {
  label: string;
  value: number | string;
  onChange?: (n: number) => void;
  suffix?: string;
  editable?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/40 bg-white/50 px-3 py-1.5 backdrop-blur">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        {editable && typeof value === "number" ? (
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange?.(Number(e.target.value) || 0)}
            className="w-full bg-transparent text-base font-semibold tabular-nums outline-none"
          />
        ) : (
          <span className="text-base font-semibold tabular-nums">{value}</span>
        )}
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function PaperOverview({ paper }: { paper: Paper }) {
  const setMeta = usePaperStore((s) => s.updatePaperMeta);
  const applyOverallDifficulty = usePaperStore((s) => s.applyOverallDifficulty);
  const setSectionTarget = usePaperStore((s) => s.setSectionTargetQuestions);
  const setSectionMarksPerQ = usePaperStore((s) => s.setSectionMarksPerQ);
  const setSectionTitle = usePaperStore((s) => s.setSectionTitle);
  const addSection = usePaperStore((s) => s.addSection);
  const setTopicWeight = usePaperStore((s) => s.setTopicWeight);

  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const [applyingDifficulty, setApplyingDifficulty] = useState(false);

  const totals = useMemo(() => {
    let q = 0;
    let m = 0;
    paper.sections.forEach((s) => s.questions.forEach((qq) => { q += 1; m += qq.marks; }));
    return { q, m };
  }, [paper]);

  const weights = paper.topicWeights ?? Object.fromEntries(
    paper.topics.map((t) => [t, Math.round(100 / paper.topics.length)]),
  );
  const weightSum = paper.topics.reduce((acc, t) => acc + Math.round(weights[t] ?? 0), 0);

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

  const sectionMismatches = paper.sections.filter(
    (s) => (s.targetQuestions ?? s.questions.length) !== s.questions.length,
  );

  const handleConfirmDifficulty = async () => {
    if (!pendingDifficulty) return;
    setApplyingDifficulty(true);
    await applyOverallDifficulty(pendingDifficulty);
    setApplyingDifficulty(false);
    setPendingDifficulty(null);
  };

  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Paper overview</h2>
          <p className="text-[11px] text-muted-foreground">{paper.className} · {paper.subject}</p>
        </div>
        <div className="inline-flex rounded-lg border border-white/40 bg-white/50 p-0.5 backdrop-blur">
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

      {/* Compact stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total marks" value={totals.m} onChange={(n) => setMeta({ totalMarks: n })} suffix="marks" />
        <Stat label="Time" value={paper.durationMinutes} onChange={(n) => setMeta({ durationMinutes: n })} suffix="min" max={600} />
        <Stat label="Questions" value={totals.q} editable={false} suffix="total" />
        <Stat label="Sections" value={paper.sections.length} editable={false} />
      </div>

      {/* Sections + Topics side-by-side */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Sections table */}
        <div className="lg:col-span-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sections</div>
          <div className="overflow-hidden rounded-xl border border-white/40 bg-white/40 backdrop-blur">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2.5 py-1.5 text-left font-medium">Section</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Target Qs</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Actual</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">M/Q</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {paper.sections.map((sec) => {
                  const mpq = sec.questions[0]?.marks ?? 1;
                  const total = sec.questions.reduce((acc, q) => acc + q.marks, 0);
                  const target = sec.targetQuestions ?? sec.questions.length;
                  const actual = sec.questions.length;
                  const mismatch = target !== actual;
                  return (
                    <tr key={sec.id} className="border-b border-white/30 last:border-b-0">
                      <td className="px-2 py-1">
                        <input
                          value={sec.title}
                          onChange={(e) => setSectionTitle(sec.id, e.target.value)}
                          className="w-full rounded-md bg-transparent px-1.5 py-0.5 font-serif text-[13px] outline-none focus:bg-white/70"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={target}
                          onChange={(e) => setSectionTarget(sec.id, Number(e.target.value) || 1)}
                          className="w-12 rounded-md bg-white/60 px-1.5 py-0.5 text-right text-[13px] tabular-nums outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className={cn("px-2 py-1 text-right text-[13px] tabular-nums", mismatch ? "text-amber-700 font-semibold" : "text-muted-foreground")}>
                        {actual}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={mpq}
                          onChange={(e) => setSectionMarksPerQ(sec.id, Number(e.target.value) || 1)}
                          className="w-12 rounded-md bg-white/60 px-1.5 py-0.5 text-right text-[13px] tabular-nums outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-[13px] font-medium tabular-nums">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              onClick={() => addSection()}
              className="flex w-full items-center justify-center gap-1 border-t border-white/40 bg-white/30 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
            >
              <Plus className="size-3" /> Add section
            </button>
          </div>
          {sectionMismatches.length > 0 && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>
                {sectionMismatches.length === 1
                  ? `${sectionMismatches[0].title} has a target/actual mismatch.`
                  : `${sectionMismatches.length} sections have target/actual mismatches.`}
              </span>
            </div>
          )}
        </div>

        {/* Topics weightage */}
        <div className="lg:col-span-2">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Topic weightage</div>
          <div className="rounded-xl border border-white/40 bg-white/40 p-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-3">
              <div className="relative h-[72px] w-[72px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutData} dataKey="marks" innerRadius={22} outerRadius={34} stroke="white" strokeWidth={2} paddingAngle={2}>
                      {donutData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-[10px] font-semibold tabular-nums">{totals.m}m</div>
                </div>
              </div>
              <div className="flex-1 text-[11px] text-muted-foreground">
                Set the target % per topic. Totals should add up to 100%.
              </div>
            </div>
            <div className="space-y-1">
              {paper.topics.map((topic, i) => {
                const w = Math.round(weights[topic] ?? 0);
                const color = `var(${TOPIC_VARS[i % TOPIC_VARS.length]})`;
                return (
                  <div key={topic} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="flex-1 truncate text-[12px] font-medium">{topic}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={w}
                      onChange={(e) => setTopicWeight(topic, Number(e.target.value) || 0)}
                      className="w-14 rounded-md bg-white/70 px-1.5 py-0.5 text-right text-[12px] tabular-nums outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-[11px] text-muted-foreground">%</span>
                  </div>
                );
              })}
            </div>
            {weightSum !== 100 && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>
                  Weights total <strong>{weightSum}%</strong>. Adjust to reach 100%.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
