import { Monitor } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function DesktopBanner() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <Monitor className="size-3.5 shrink-0" />
      Paperly works best on a desktop — copilot and paper preview side by side.
    </div>
  );
}
