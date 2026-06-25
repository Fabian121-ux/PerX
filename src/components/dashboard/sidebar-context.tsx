"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);
const SIDEBAR_STORAGE_KEY = "perx-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "perx-sidebar-collapsed-change";

function getSidebarSnapshot() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeToSidebarChanges(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange);
  };
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isCollapsed = useSyncExternalStore(subscribeToSidebarChanges, getSidebarSnapshot, () => false);

  const toggleCollapse = useCallback(() => {
    const next = !getSidebarSnapshot();
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapse }}>
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
