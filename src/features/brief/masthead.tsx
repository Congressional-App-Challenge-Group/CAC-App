"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CivicSeal } from "@/components/ui/civic-seal";
import { CityscapeFallback } from "@/features/brief/cityscape-fallback";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";

const CivicCityScene = dynamic(
  () => import("@/features/brief/civic-city-scene").then((module) => module.CivicCityScene),
  { ssr: false },
);

export function Masthead({ changedThisWeek }: { changedThisWeek: number }) {
  const decisions = useDecisions();
  const { preferences, ready } = usePreferences();
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }));
  }, []);

  const located = decisions.filter(
    (decision) => decision.geography?.zipCode || decision.geography?.address,
  ).length;
  const rewritten = decisions.filter((decision) => decision.plainLanguageApproved).length;

  return (
    <section className="front-porch" aria-labelledby="front-porch-title">
      <div className="front-porch__city" aria-hidden="true">
        <CityscapeFallback />
        <div className="front-porch__city-scene">
          <CivicCityScene />
        </div>
      </div>
      <div className="shell front-porch__inner">
        <div className="front-porch__main">
          <div className="front-porch__edition">
            <CivicSeal className="front-porch__seal" />
            <span>
              <b>THE CHARLOTTE–MECKLENBURG RECORD</b>
              <small>{today ?? "AN INDEPENDENT PUBLIC RECORD"}</small>
            </span>
          </div>
          <p className="eyebrow">Local government · Open record</p>
          <h1 id="front-porch-title" className="front-porch__title">
            Charlotte<br />doesn&apos;t <span>stand still.</span>
          </h1>
          <p className="mt-5 reading">
            City and county decisions, made legible. See what is moving, what it means, and the
            public record behind every detail.
          </p>
          <div className="front-porch__actions">
            <Link href="/explore" className="civic-cover__primary">
              Explore the public record <ArrowUpRight size={18} />
            </Link>
            <Link href="/ask" className="civic-cover__secondary">
              Ask a question <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="civic-cover__source-note">
            CHARLOTTE · MECKLENBURG COUNTY · DURHAM COUNTY · CMS
          </p>
        </div>

        <aside className="front-porch__ledger" aria-label="Civic record at a glance">
          <p className="front-porch__ledger-label">
            The public ledger <span>{ready ? `· ZIP ${preferences.zipCode}` : "· Your area"}</span>
          </p>
          <div className="front-porch__lead-number">
            <span>{decisions.length.toLocaleString("en-US")}</span>
            <p>official records<br />indexed</p>
          </div>
          <div className="front-porch__ledger-rule" />
          <dl className="front-porch__facts">
            <div><dt>Moved this week</dt><dd>{changedThisWeek.toLocaleString("en-US")}</dd></div>
            <div><dt>Places confirmed</dt><dd>{located.toLocaleString("en-US")}</dd></div>
            <div><dt>Plain language reviewed</dt><dd>{rewritten.toLocaleString("en-US")}<small> / {decisions.length.toLocaleString("en-US")}</small></dd></div>
          </dl>
          <div className="front-porch__ledger-note">
            <span>Every entry links to its source.</span>
            <b>Nothing guessed. Nothing hidden.</b>
          </div>
          <CivicSeal className="civic-cover__watermark" />
        </aside>
      </div>
    </section>
  );
}
