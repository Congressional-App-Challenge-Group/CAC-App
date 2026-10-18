"use client";

import { useMemo } from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { buildDisclosureReport, gapPercent, headlineGap } from "@/lib/disclosure";
import { Surface } from "@/components/ui/card";

/**
 * The thesis, on the front page instead of three clicks away.
 *
 * Every other civic tool answers "what did the government publish". This one also
 * counts what the record left out, and it is the reason the rest of the product
 * behaves the way it does: a blank field stays blank, a date that was never
 * stated is never estimated, and a rewrite is not published until it has been
 * checked against the source. Showing the count of its own unfinished work — the
 * records still in the agency's own wording — is the same rule pointed at itself.
 *
 * Only now-independent figures appear here. `buildDisclosureReport` also measures
 * what is scheduled, which depends on the current time, and rendering that during
 * hydration would let the server and client disagree.
 */
export function Omission() {
  const decisions = useDecisions();
  const report = useMemo(() => buildDisclosureReport(decisions), [decisions]);

  const headline = headlineGap(report);
  const language = report.gaps.find((gap) => gap.key === "language");
  const rewritten = report.total - (language?.missing ?? 0);

  if (!report.total || !headline) return null;

  return (
    <section aria-labelledby="omission-heading">
      <Surface className="overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[1.5fr_1fr]">
          <div className="p-6 md:p-8">
            <p className="eyebrow flex items-center gap-2">
              <EyeOff size={13} aria-hidden="true" />
              The other half of the record
            </p>
            <h2 id="omission-heading" className="mt-3 display-3 text-ink">
              What the record doesn&apos;t say
            </h2>
            <p className="reading mt-4 max-w-xl">
              Every civic tool reports what a government published. This one also counts what it
              left out — and leaves the blank blank rather than filling it with a guess.
            </p>

            {/*
              The denominator is the headline measure's own, never the size of the
              dataset. Saying "100% of the 763 records" about a measure that covers
              278 of them is exactly the overstatement the product's rule forbids,
              and it was on the front page until this line was corrected.
            */}
            <p className="mt-5 max-w-xl text-sm leading-6 text-ink-soft">
              <b className="text-ink">
                {gapPercent(headline)}% of the {headline.total} records this measure covers disclose{" "}
                {headline.missingLabel.toLowerCase()}
              </b>{" "}
              — {headline.missing} of them
              {headline.total === report.total ? "" : `, out of ${report.total} indexed in total`}.{" "}
              {language && language.missing > 0 ? (
                <>
                  And {language.missing} of the {report.total} still reach you in the agency&apos;s own
                  wording, which is the one gap here that CivicLens can close: {rewritten} have been
                  rewritten and checked against the source.
                </>
              ) : (
                <>Every one of them has a rewrite checked against the source.</>
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/evidence" className="btn btn-primary">
                See every gap, with its denominator
              </Link>
              <Link href="/about" className="btn btn-secondary">
                How the counting works
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 content-start gap-px border-t border-line bg-line md:grid-cols-1 md:border-l md:border-t-0">
            <Figure value={report.total - report.located} caption="Records with no location the county could confirm" />
            <Figure value={rewritten} caption="Records rewritten in plain language after review" />
            <Figure value={report.total} caption="Records traced to an official source" />
          </dl>
        </div>
      </Surface>
    </section>
  );
}

function Figure({ value, caption }: { value: number; caption: string }) {
  return (
    <div className="bg-surface p-5 md:p-6">
      <dt className="text-3xl font-black tracking-[-0.045em] text-ink md:text-4xl">
        {value.toLocaleString("en-US")}
      </dt>
      <dd className="mt-1.5 text-xs leading-5 text-muted">{caption}</dd>
    </div>
  );
}
