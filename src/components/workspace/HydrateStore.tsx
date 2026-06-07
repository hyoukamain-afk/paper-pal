import { useEffect } from "react";
import { usePaperStore } from "@/store/paperStore";

export function HydrateStore() {
  const hydrate = usePaperStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}
