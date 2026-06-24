"use client";

import { useEffect, useState } from "react";

export function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-opacity duration-1000 motion-reduce:hidden" 
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.08]" />

      <div className="absolute inset-0 opacity-35">
        <div className="absolute -left-[18%] -top-[26%] h-[54rem] w-[54rem] rounded-full bg-[color:var(--px-gold)]/18 blur-[150px] animate-blob" />
        <div className="absolute right-[-22%] top-[18%] h-[40rem] w-[40rem] rounded-full bg-[color:var(--px-gold-bright)]/10 blur-[150px] animate-blob animation-delay-2000" />
      </div>

      <div className="absolute inset-0 opacity-25">
        <div className="absolute left-[18%] top-[22%] h-1.5 w-1.5 rounded-full bg-[color:var(--px-gold-bright)] shadow-[0_0_10px_rgba(245,185,66,0.65)] animate-float" />
        <div className="absolute right-[24%] top-[46%] h-2 w-2 rounded-full bg-[color:var(--px-gold)] shadow-[0_0_10px_rgba(212,160,23,0.58)] animate-float animation-delay-2000" />
        <div className="absolute left-[34%] bottom-[24%] h-px w-[18rem] rotate-[-18deg] bg-gradient-to-r from-transparent via-[color:var(--px-gold)]/35 to-transparent animate-float animation-delay-4000" />
      </div>
    </div>
  );
}
