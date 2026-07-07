import { getResolvedDataMode } from "@/lib/env";

export function MockModeIndicator() {
  const mode = getResolvedDataMode();
  
  if (mode !== "mock") return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400 tracking-wide uppercase">
          Local Mock Data
        </span>
      </div>
    </div>
  );
}
