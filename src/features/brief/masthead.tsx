"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";
import { buttonClass } from "@/components/ui/button";
import { govSources } from "@/lib/sources";
import { Stat } from "@/components/ui/stat";

export function Masthead({ changedThisWeek }: { changedThisWeek: number }) {
  const decisions = useDecisions();
  const { preferences, ready } = usePreferences();
  // Rendered after mount so the server and client markup cannot disagree on the date.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    );
  }, []);

  const located = decisions.filter(
    (decision) => decision.geography?.zipCode || decision.geography?.address,
  ).length;

  /**
   * How many records carry an editor-approved rewrite.
   *
   * The hero used to promise plain language unconditionally. It is now a measured
   * figure, so the sentence and the count can never drift apart.
   */
  const rewritten = decisions.filter((decision) => decision.plainLanguageApproved).length;

  return (
    <section className="relative overflow-hidden border-b border-line bg-surface-2">
      <div className="hero-grid absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="shell relative py-12 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow" suppressHydrationWarning>
              {today ? `Your brief · ${today}` : "Your brief"}
            </p>
            <h1 className="mt-4 display-1 text-ink">
              What&apos;s changing{" "}
              <span className="text-civic">where you live.</span>
            </h1>
            <p className="mt-6 max-w-2xl reading md:text-lg">
              Decisions from {govSources.map((source) => source.name).join(", ")} — rewritten in plain
              language and linked to the official record. When a record doesn&apos;t confirm something,
              we say so instead of guessing, and we count those silences rather than hide them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/explore" className={buttonClass("primary", "lg")}>
                Explore decisions
                <ArrowRight size={18} />
              </Link>
              <Link href="/ask" className={buttonClass("secondary", "lg")}>
                Ask the record
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <Stat value={decisions.length} label="Tracked records" />
            <Stat
              value={changedThisWeek}
              label="Changed this week"
              hint={changedThisWeek === 0 ? "No movements recorded yet" : undefined}
            />
            <Stat value={located} label="With a confirmed location" />
            <Stat
              className="col-span-2"
              value={rewritten}
              label="Rewritten in plain language"
              hint={
                decisions.length
                  ? `Reviewed against the source. ${decisions.length - rewritten} keep the agency's own wording.`
                  : undefined
              }
            />
            <Stat value={ready ? preferences.zipCode : "—"} label="Your ZIP code" />
          </dl>
        </div>
      </div>
    </section>
  );
}
