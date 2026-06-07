import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Paper } from "@/lib/types";

const TOPIC_VARS = ["--topic-1", "--topic-2", "--topic-3", "--topic-4", "--topic-5"];

export function MarksDonut({ paper }: { paper: Paper }) {
  const data = useMemo(() => {
    const map = new Map<string, { marks: number; count: number }>();
    paper.sections.forEach((sec) =>
      sec.questions.forEach((q) => {
        const cur = map.get(q.topic) ?? { marks: 0, count: 0 };
        cur.marks += q.marks;
        cur.count += 1;
        map.set(q.topic, cur);
      }),
    );
    return [...map.entries()].map(([topic, v], i) => ({
      topic,
      marks: v.marks,
      count: v.count,
      color: `var(${TOPIC_VARS[i % TOPIC_VARS.length]})`,
    }));
  }, [paper]);

  const total = data.reduce((s, d) => s + d.marks, 0);

  return (
    <div className="rounded-xl bg-surface/60 p-3.5">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Marks by topic</div>
      <div className="flex items-center gap-3">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="marks"
                innerRadius={36}
                outerRadius={56}
                stroke="var(--background)"
                strokeWidth={2}
                paddingAngle={2}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center leading-tight">
              <div className="text-base font-semibold">{total}</div>
              <div className="text-[10px] text-muted-foreground">marks</div>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2 overflow-hidden">
          {data.map((d) => (
            <li key={d.topic} className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="truncate text-xs font-medium">{d.topic}</span>
              </div>
              <div className="pl-3.5 text-[10px] tabular-nums text-muted-foreground">
                {d.marks} marks · {d.count} q
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
