import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Topbar } from "./Topbar";
import { CopilotPanel } from "@/components/chat/CopilotPanel";
import { PaperPanel } from "@/components/paper/PaperPanel";
import { Toaster } from "@/components/ui/sonner";
import { HydrateStore } from "./HydrateStore";
import { DesktopBanner } from "./DesktopBanner";

export function Workspace() {
  return (
    <div className="flex h-screen w-full flex-col text-foreground">
      <HydrateStore />
      <DesktopBanner />
      <Topbar />
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={64} minSize={45}>
            <PaperPanel />
          </Panel>
          <PanelResizeHandle className="group relative w-px bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/60">
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </PanelResizeHandle>
          <Panel defaultSize={36} minSize={26} maxSize={55}>
            <CopilotPanel />
          </Panel>
        </PanelGroup>
      </div>
      <Toaster />
    </div>
  );
}
