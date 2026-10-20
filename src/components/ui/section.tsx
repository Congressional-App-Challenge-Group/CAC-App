import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1 display-3 text-ink">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="text-sm font-extrabold text-civic hover:text-civic-strong"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading__inner">
        <div className="page-heading__copy max-w-3xl">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="mt-3 display-1 text-ink">{title}</h1>
          {description ? <p className="mt-5 reading md:text-lg">{description}</p> : null}
        </div>
        {aside ? <div className="page-heading__aside">{aside}</div> : null}
      </div>
    </header>
  );
}
