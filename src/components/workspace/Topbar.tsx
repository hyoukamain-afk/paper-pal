import { useState } from "react";
import { Download, FileText, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePaperStore } from "@/store/paperStore";
import { exportPaperPdf } from "@/components/pdf/exportPdf";
import { toast } from "sonner";
export function Topbar() {
  const paper = usePaperStore((s) => s.paper);
  const resetEmpty = usePaperStore((s) => s.resetEmpty);
  const loadSample = usePaperStore((s) => s.loadSample);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!paper) {
      toast.error("Generate a paper first");
      return;
    }
    setExporting(true);
    try {
      await exportPaperPdf(paper);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-14 shrink-0 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-foreground text-background">
            <Sparkles className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Paperly</div>
            <div className="text-[11px] text-muted-foreground">Exam paper copilot</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Plus className="size-4" />
                New paper
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new paper?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear the current draft and conversation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetEmpty}>Start new</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!paper && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={loadSample}>
              <FileText className="size-4" />
              Load sample
            </Button>
          )}

          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={exporting || !paper}
          >
            <Download className="size-4" />
            {exporting ? "Exporting…" : "Download PDF"}
          </Button>
        </div>
      </div>
    </header>
  );
}
