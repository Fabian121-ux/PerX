"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { UserRound, Settings, LogOut, Sun, Moon, Monitor, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";
import { signOutAction } from "@/features/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";

interface AccountMenuProps {
  user: CurrentUser;
  previewMode?: boolean;
}

export function AccountMenu({ user, previewMode = false }: AccountMenuProps) {
  const { theme, setTheme } = useTheme();
  
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  const getUsernameInitial = (username: string) =>
    username ? username.charAt(0).toUpperCase() : "";
  

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-10 w-10 overflow-hidden shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary)] font-bold text-white ring-2 ring-[color:var(--px-surface)] transition-shadow hover:ring-[color:var(--px-primary)] focus:outline-none focus:ring-[color:var(--px-primary)]"
          aria-label="Open account menu"
        >
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.imageUrl} alt={user.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : user.name ? (
            getInitials(user.name)
          ) : user.username ? (
            getUsernameInitial(user.username)
          ) : (
            <UserRound size={20} />
          )}
        </button>
      </DropdownMenu.Trigger>
      
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-[100] w-64 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 shadow-lg animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          sideOffset={8}
          align="end"
        >
          <div className="flex flex-col px-3 py-2">
            <span className="text-sm font-bold text-[color:var(--px-text)]">{user.name}</span>
            <span className="text-xs text-[color:var(--px-text-muted)] truncate">{user.email}</span>
            {previewMode && (
              <span className="mt-1 w-max rounded-full bg-[color:var(--px-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--px-primary)] ring-1 ring-[color:var(--px-primary)]/35">
                Preview Mode
              </span>
            )}
          </div>
          
          <DropdownMenu.Separator className="my-1 h-px bg-[color:var(--px-border)]" />
          
          <DropdownMenu.Item asChild onSelect={() => {}}>
            <Link href="/app/profile" className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]">
              <UserRound size={16} className="text-[color:var(--px-text-muted)]" />
              View profile
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link href="/app/settings" className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]">
              <Settings size={16} className="text-[color:var(--px-text-muted)]" />
              Settings
            </Link>
          </DropdownMenu.Item>
          
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)] data-[state=open]:bg-[color:var(--px-muted)]">
              <Sun size={16} className="text-[color:var(--px-text-muted)] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon size={16} className="absolute text-[color:var(--px-text-muted)] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              Theme
              <ChevronRight size={16} className="ml-auto text-[color:var(--px-text-muted)]" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent 
                className="z-[101] min-w-[120px] rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
                sideOffset={4}
              >
                <DropdownMenu.Item 
                  onClick={() => setTheme("light")}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
                >
                  <Sun size={14} className={theme === "light" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)]"} />
                  <span className={theme === "light" ? "font-bold text-[color:var(--px-primary)]" : ""}>Light</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={() => setTheme("dark")}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
                >
                  <Moon size={14} className={theme === "dark" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)]"} />
                  <span className={theme === "dark" ? "font-bold text-[color:var(--px-primary)]" : ""}>Dark</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={() => setTheme("system")}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
                >
                  <Monitor size={14} className={theme === "system" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)]"} />
                  <span className={theme === "system" ? "font-bold text-[color:var(--px-primary)]" : ""}>System</span>
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="my-1 h-px bg-[color:var(--px-border)]" />
          
          {previewMode ? (
            <DropdownMenu.Item asChild>
              <Link
                href="/sign-in"
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 outline-none transition-colors hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
              >
                <LogOut size={16} />
                Exit Preview
              </Link>
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item asChild>
              <form action={signOutAction} className="w-full">
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 outline-none transition-colors hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </form>
            </DropdownMenu.Item>
          )}

        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
