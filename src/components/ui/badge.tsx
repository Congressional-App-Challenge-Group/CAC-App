import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DecisionStatus } from "@/types";

export function StatusBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  return (
    <span className={cn("status", className)} data-status={status}>
      {status}
    </span>
  );
}

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-ink-soft",
  accent: "border-civic/35 bg-civic/8 text-civic-strong",
  success: "border-success/30 bg-success-bg text-success",
  warning: "border-warning/30 bg-warning-bg text-warning",
  danger: "border-danger/30 bg-danger-bg text-danger",
  info: "border-info/30 bg-info-bg text-info",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.06em]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const verificationTone: Record<string, { tone: Tone; label: string }> = {
  verified: { tone: "success", label: "Verified source" },
  reviewed: { tone: "info", label: "Editor reviewed" },
  unconfirmed: { tone: "warning", label: "Unconfirmed" },
};

export function VerificationBadge({ status }: { status: string }) {
  const meta = verificationTone[status] ?? verificationTone.unconfirmed;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
