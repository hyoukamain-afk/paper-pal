import type { Paper } from "@/lib/types";
import { ConfigSummary } from "./ConfigSummary";
import { MarksDonut } from "./MarksDonut";
import { KpiTiles } from "./KpiTiles";

export function InsightsStrip({ paper }: { paper: Paper }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Paper insights</h2>
          <p className="text-xs text-muted-foreground">Live summary of your draft</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ConfigSummary paper={paper} />
        </div>
        <div className="lg:col-span-4">
          <MarksDonut paper={paper} />
        </div>
        <div className="lg:col-span-4">
          <KpiTiles paper={paper} />
        </div>
      </div>
    </section>
  );
}
