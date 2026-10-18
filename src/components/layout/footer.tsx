import Link from "next/link";
import { govSources } from "@/lib/sources";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface-2/60">
      <div className="shell grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="brand-mark grid h-8 w-8 place-items-center rounded-lg text-xs font-black">
              CL
            </span>
            <div>
              <p className="text-base font-black leading-none tracking-[-0.03em] text-ink">CivicLens</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.17em] text-subtle">
                Charlotte–Mecklenburg
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Local government decisions, linked to the official record and rewritten in plain language
            once the wording has passed a review that checks it against the source. Where a record does
            not confirm something, CivicLens leaves it blank rather than guessing — and counts the
            blanks.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-subtle">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { href: "/explore", label: "All decisions" },
              { href: "/changes", label: "What changed" },
              { href: "/my-area", label: "My area" },
              { href: "/ask", label: "Ask the record" },
              { href: "/evidence", label: "What the record omits" },
              { href: "/about", label: "How it works" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-bold text-ink-soft transition-colors hover:text-civic"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-subtle">Sources</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {govSources.map((source) => (
              <li key={source.key}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-bold text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-civic"
                >
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-subtle">
          <p>
            An independent civic project. Not affiliated with, or endorsed by, the City of Charlotte,
            Mecklenburg County, or Charlotte-Mecklenburg Schools.
          </p>
          <p>The linked government record is always authoritative.</p>
        </div>
      </div>
    </footer>
  );
}
