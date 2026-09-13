import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card p-10 text-center", className)}>
      {icon ? (
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-3 text-civic">
          {icon}
        </div>
      ) : null}
      <h2 className="mt-4 text-xl font-black tracking-[-0.03em] text-ink">{title}</h2>
      {body ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center gap-3">{action}</div> : null}
    </div>
  );
}
