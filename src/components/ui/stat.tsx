import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stat({
  value,
  label,
  hint,
  className,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("surface px-4 py-3", className)}>
      <p className="text-xl font-black tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function StatRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("grid gap-3 sm:grid-cols-3", className)}>{children}</div>;
}
