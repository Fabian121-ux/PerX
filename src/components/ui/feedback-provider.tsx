"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";

type ToastTone = "error" | "info" | "success";

export type ToastInput = {
  description?: string;
  duration?: number | null;
  title: string;
  tone?: ToastTone;
};

export type ConfirmInput = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  title: string;
  tone?: "danger" | "default";
};

type ToastRecord = ToastInput & { id: string; tone: ToastTone };
type ConfirmRecord = ConfirmInput & {
  resolve: (confirmed: boolean) => void;
};

type FeedbackContextValue = {
  confirm: (input: ConfirmInput) => Promise<boolean>;
  toast: (input: ToastInput) => string;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const idPrefix = useId();
  const toastCounter = useRef(0);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmRecord | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${idPrefix}-${toastCounter.current++}`;
      setToasts((current) => [
        ...current.slice(-3),
        { ...input, id, tone: input.tone ?? "info" },
      ]);
      return id;
    },
    [idPrefix],
  );

  const confirm = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setConfirmation((current) => {
        current?.resolve(false);
        return { ...input, resolve };
      });
    });
  }, []);

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="perx-toast-viewport pointer-events-none fixed inset-x-3 z-[90] flex flex-col items-stretch gap-2 sm:left-auto sm:right-5 sm:w-[min(24rem,calc(100vw-2rem))]"
        role="region"
      >
        {toasts.map((item) => (
          <ToastCard dismiss={dismissToast} key={item.id} toast={item} />
        ))}
      </div>
      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) resolveConfirmation(false);
        }}
        open={Boolean(confirmation)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-[color:var(--px-overlay)] backdrop-blur-[2px]" />
          <Dialog.Content
            className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[101] rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 shadow-[var(--px-shadow-strong)] focus:outline-none sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-6"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              const content = event.currentTarget as HTMLElement | null;
              content
                ?.querySelector<HTMLButtonElement>("[data-confirm-cancel]")
                ?.focus();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-black text-[color:var(--px-text)]">
                  {confirmation?.title ?? "Confirm action"}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  {confirmation?.description}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close confirmation"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  type="button"
                >
                  <X aria-hidden size={19} />
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                data-confirm-cancel
                onClick={() => resolveConfirmation(false)}
                type="button"
                variant="secondary"
              >
                {confirmation?.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                onClick={() => resolveConfirmation(true)}
                type="button"
                variant={confirmation?.tone === "danger" ? "destructive" : "primary"}
              >
                {confirmation?.confirmLabel ?? "Continue"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </FeedbackContext.Provider>
  );
}

function ToastCard({
  dismiss,
  toast,
}: {
  dismiss: (id: string) => void;
  toast: ToastRecord;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const duration =
      toast.duration === undefined
        ? toast.tone === "error"
          ? null
          : 4_500
        : toast.duration;
    if (duration === null || paused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [dismiss, paused, toast.duration, toast.id, toast.tone]);

  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "error"
        ? CircleAlert
        : Info;

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-elevated)] p-4 text-[color:var(--px-text)] shadow-[var(--px-shadow-strong)]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <span
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          toast.tone === "success"
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            : toast.tone === "error"
              ? "bg-red-500/12 text-red-700 dark:text-red-300"
              : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
        }`}
      >
        <Icon aria-hidden size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        aria-label={`Dismiss ${toast.title}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        onClick={() => dismiss(toast.id)}
        type="button"
      >
        <X aria-hidden size={16} />
      </button>
    </div>
  );
}

function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("FeedbackProvider is required.");
  return value;
}

export function useConfirm() {
  return useFeedback().confirm;
}

export function useToast() {
  return useFeedback().toast;
}
