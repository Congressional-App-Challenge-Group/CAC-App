import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  elevated,
  children,
  ...rest
}: ComponentProps<"div"> & { elevated?: boolean }) {
  return (
    <div className={cn("card", elevated && "card-elevated", className)} {...rest}>
      {children}
    </div>
  );
}

export function Surface({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("surface", className)} {...rest}>
      {children}
    </div>
  );
}

/** A tinted, inset block for "what changed" style callouts. */
export function Note({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "accent" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-surface-2",
    accent: "border-civic/40 bg-civic/5",
    warning: "border-warning/40 bg-warning-bg",
    danger: "border-danger/40 bg-danger-bg",
  };
  return (
    <div className={cn("rounded-[var(--radius)] border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
