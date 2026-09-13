import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, children, ...rest }: ComponentProps<"label">) {
  return (
    <label className={cn("block text-sm font-bold text-ink", className)} {...rest}>
      {children}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn("field", className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: ComponentProps<"textarea">) {
  return <textarea className={cn("field min-h-28", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn("field font-bold", className)} {...rest}>
      {children}
    </select>
  );
}

export function HelpText({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-1.5 text-xs text-subtle", className)}>{children}</p>;
}
