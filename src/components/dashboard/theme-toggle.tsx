"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--px-muted)]" aria-hidden="true" />
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-muted)] hover:text-[color:var(--px-primary)] focus:bg-[color:var(--px-muted)] focus:text-[color:var(--px-primary)] focus:outline-none"
          aria-label="Change theme"
        >
          {theme === "light" ? (
            <Sun size={20} />
          ) : theme === "dark" ? (
            <Moon size={20} />
          ) : (
            <Monitor size={20} />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[150px] overflow-hidden rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 shadow-md animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          align="end"
          sideOffset={8}
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            onClick={() => setTheme("light")}
          >
            <Sun size={16} className={theme === "light" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)]"} />
            <span className={theme === "light" ? "font-bold" : ""}>Light</span>
          </DropdownMenu.Item>
          
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            onClick={() => setTheme("dark")}
          >
            <Moon size={16} className={theme === "dark" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)]"} />
            <span className={theme === "dark" ? "font-bold" : ""}>Dark</span>
          </DropdownMenu.Item>
          
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            onClick={() => setTheme("system")}
          >
            <Monitor size={16} className={theme === "system" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)]"} />
            <span className={theme === "system" ? "font-bold" : ""}>System</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
