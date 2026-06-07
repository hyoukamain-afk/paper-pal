import { usePaperStore } from "@/store/paperStore";
import { PaperPreview } from "./PaperPreview";
import { PaperOverview } from "./PaperOverview";
import { SyllabusSources } from "./SyllabusSources";
import { EmptyState } from "@/components/workspace/EmptyState";

export function PaperPanel() {
  const paper = usePaperStore((s) => s.paper);

  if (!paper) {
    return (
      <div className="h-full overflow-y-auto">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-5">
        <SyllabusSources paper={paper} />
        <PaperOverview paper={paper} />
        <PaperPreview paper={paper} />
      </div>
    </div>
  );
}
