import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FilterChip({
  active,
  className,
  children,
  ...rest
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-active={active}
      aria-pressed={active}
      className={cn("chip", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("chip chip-static", className)}>{children}</span>;
}

export function ChipRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}
