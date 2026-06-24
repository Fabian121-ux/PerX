"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    try {
      const stored = localStorage.getItem("perx-sidebar-collapsed");
      if (stored === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCollapsed(true);
      }
    } catch {
      // Ignore
    }
    return () => clearTimeout(timer);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("perx-sidebar-collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed: isMounted ? isCollapsed : false, toggleCollapse }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
