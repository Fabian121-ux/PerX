import { Check, CircleDashed, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TrustPresentation } from "@/lib/trust/presentation";
import { trustBadgeClassName } from "@/lib/trust/engine";

export function TrustLevelBadge({
  presentation,
}: {
  presentation: TrustPresentation;
}) {
  return (
    <Badge className={trustBadgeClassName(presentation.summary.level)}>
      <ShieldCheck aria-hidden className="mr-1" size={13} />
      {presentation.summary.shortLabel}
    </Badge>
  );
}

export function TrustPresentationCard({
  presentation,
  variant = "full",
}: {
  presentation: TrustPresentation;
  variant?: "compact" | "full";
}) {
  const score = presentation.score;

  return (
    <section className="rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
            <ShieldCheck aria-hidden size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--px-primary)]">
              Trust profile
            </p>
            <h2 className="mt-1 text-lg font-black text-[color:var(--px-text)]">
              {presentation.summary.label}
            </h2>
          </div>
        </div>
        <TrustLevelBadge presentation={presentation} />
      </div>

      <p className="mt-4 text-sm leading-6 text-[color:var(--px-text-muted)]">
        {presentation.summary.description}
      </p>

      {score.kind === "authoritative" ? (
        <div className="mt-5 rounded-2xl bg-[color:var(--px-surface-soft)] p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[color:var(--px-text-muted)]">
                Authoritative score
              </p>
              <p className="mt-1 text-3xl font-black text-[color:var(--px-text)]">
                {score.normalizedValue}
                <span className="text-base text-[color:var(--px-text-muted)]">
                  /100
                </span>
              </p>
            </div>
            <p className="text-right text-xs text-[color:var(--px-text-muted)]">
              Updated {formatDate(score.lastUpdatedAt)}
            </p>
          </div>
          <div
            aria-label={`Trust score ${score.normalizedValue} out of 100`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={score.normalizedValue}
            className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--px-muted)]"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-[color:var(--px-primary)]"
              style={{ width: `${score.normalizedValue}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">
            Methodology {score.methodologyVersion}
          </p>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[color:var(--px-surface-soft)] p-4">
          <CircleDashed
            aria-hidden
            className="mt-0.5 shrink-0 text-[color:var(--px-text-muted)]"
            size={18}
          />
          <div>
            <p className="text-sm font-bold text-[color:var(--px-text)]">
              Numeric score not published
            </p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
              PerX shows explainable evidence levels until an authoritative,
              audited scoring methodology is available.
            </p>
          </div>
        </div>
      )}

      {variant === "full" ? (
        <>
          <div className="mt-5 grid gap-3">
            <h3 className="text-sm font-black text-[color:var(--px-text)]">
              Evidence factors
            </h3>
            {presentation.factors.map((factor) => (
              <div
                className="rounded-xl border border-[color:var(--px-border)] p-3"
                key={factor.key}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[color:var(--px-text)]">
                    {factor.label}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--px-text-muted)]">
                    {factor.state === "met" ? (
                      <Check aria-hidden className="text-emerald-600" size={14} />
                    ) : null}
                    {factorStateLabel(factor.state)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
                  {factor.detail}
                </p>
                {factor.progress !== undefined ? (
                  <div
                    aria-label={`${factor.label} ${Math.round(factor.progress)}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(factor.progress)}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--px-muted)]"
                    role="progressbar"
                  >
                    <div
                      className="h-full rounded-full bg-[color:var(--px-primary)]"
                      style={{ width: `${factor.progress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {presentation.guidance.length ? (
            <div className="mt-5 border-t border-[color:var(--px-border)] pt-4">
              <h3 className="text-sm font-black text-[color:var(--px-text)]">
                How to build trust
              </h3>
              <ul className="mt-2 grid gap-2 text-xs leading-5 text-[color:var(--px-text-muted)]">
                {presentation.guidance.slice(0, 3).map((item) => (
                  <li className="flex gap-2" key={item}>
                    <span aria-hidden>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5 border-t border-[color:var(--px-border)] pt-4">
          <h3 className="text-xs font-black uppercase tracking-wide text-[color:var(--px-text-muted)]">
            Evidence overview
          </h3>
          <ul className="mt-2 grid gap-2">
            {presentation.factors.map((factor) => (
              <li
                className="flex items-center justify-between gap-3 text-xs"
                key={factor.key}
              >
                <span className="font-semibold text-[color:var(--px-text)]">
                  {factor.label}
                </span>
                <span className="text-right font-bold text-[color:var(--px-text-muted)]">
                  {factorStateLabel(factor.state)}
                  <span className="sr-only">. {factor.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">
        Contract {presentation.contractVersion} · {presentation.summary.calculationVersion}
      </p>
    </section>
  );
}

function factorStateLabel(state: TrustPresentation["factors"][number]["state"]) {
  if (state === "met") return "Recorded";
  if (state === "in-progress") return "In progress";
  if (state === "unavailable") return "Unavailable";
  return "Not yet recorded";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "recently"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}
