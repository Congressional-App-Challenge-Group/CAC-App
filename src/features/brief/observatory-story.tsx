"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, FileCheck2, Landmark, MapPin, Waypoints } from "lucide-react";
import { orgNames } from "@/lib/civic";
import type { ObservatoryStory } from "@/types";

function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  const date = new Date(`${(value || "").slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

function boundaryLayout(rings: number[][][], width: number, height: number, point?: [number, number]) {
  const coordinates = rings.flat();
  if (!coordinates.length) return { path: "", point: null };
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const minX = Math.min(...longitudes), maxX = Math.max(...longitudes);
  const minY = Math.min(...latitudes), maxY = Math.max(...latitudes);
  const pad = 18;
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
  const offsetX = (width - pad * 2 - (maxX - minX) * scale) / 2;
  const offsetY = (height - pad * 2 - (maxY - minY) * scale) / 2;
  const project = ([longitude, latitude]: [number, number]) => ({
    x: pad + (longitude - minX) * scale + offsetX,
    y: height - pad - (latitude - minY) * scale - offsetY,
  });
  const path = rings.map((ring) => ring.map((coordinate, index) => {
    const { x, y } = project(coordinate as [number, number]);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z").join(" ");
  return { path, point: point ? project(point) : null };
}

export function ObservatoryStory({ story }: { story: ObservatoryStory | null }) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const district = story?.district;
  const featured = story?.featured;
  const featureTimeline = featured?.timeline ?? [];
  const mapLayout = useMemo(() => district && featured
    ? boundaryLayout(district.rings, 420, 300,
      featured.geography?.longitude !== undefined && featured.geography.latitude !== undefined
        ? [featured.geography.longitude, featured.geography.latitude]
        : undefined)
    : { path: "", point: null }, [district, featured?.geography]);
  const locationHref = district ? `/places/${district.kind}/${district.code}` : "/my-area";

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".observatory-hero");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!hero || reducedMotion.matches) return;
    let frame = 0;
    const updatePointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = hero.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
      const compact = window.matchMedia("(max-width: 767px)").matches;
      hero.style.setProperty("--hero-pointer-x", `${x * (compact ? 7 : 18)}px`);
      hero.style.setProperty("--hero-pointer-y", `${y * (compact ? 6 : 14)}px`);
      hero.style.setProperty("--hero-mobile-pointer-x", `${x * 7}px`);
      hero.style.setProperty("--hero-mobile-pointer-y", `${y * 6}px`);
      hero.style.setProperty("--hero-label-pointer-x", `${x * -9}px`);
      hero.style.setProperty("--hero-label-pointer-y", `${y * -7}px`);
      hero.style.setProperty("--hero-architecture-x", `${x * -7}px`);
      hero.style.setProperty("--hero-architecture-y", `${y * -5}px`);
      hero.style.setProperty("--hero-content-pointer-x", `${x * -3}px`);
      hero.style.setProperty("--hero-content-pointer-y", `${y * -2}px`);
      hero.style.setProperty("--hero-glow-x", `${50 + x * 34}%`);
      hero.style.setProperty("--hero-glow-y", `${48 + y * 38}%`);
    };
    const resetPointer = () => {
      ["--hero-pointer-x", "--hero-pointer-y", "--hero-mobile-pointer-x", "--hero-mobile-pointer-y", "--hero-label-pointer-x", "--hero-label-pointer-y", "--hero-architecture-x", "--hero-architecture-y", "--hero-content-pointer-x", "--hero-content-pointer-y", "--hero-glow-x", "--hero-glow-y"].forEach((property) => hero.style.removeProperty(property));
    };
    const updateProgress = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = hero.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height * 0.7)));
        hero.style.setProperty("--hero-progress", progress.toFixed(3));
        hero.style.setProperty("--hero-x", `${-progress * 3}vw`);
        hero.style.setProperty("--hero-stage-y", `${progress * 5}vh`);
        hero.style.setProperty("--hero-scale", String(1 - progress * 0.13));
        hero.style.setProperty("--hero-content-y", `${-progress * 8}vh`);
        hero.style.setProperty("--hero-content-opacity", String(1 - progress * 0.7));
        hero.style.setProperty("--hero-label-x", `${progress}vw`);
        hero.style.setProperty("--hero-label-y", `${-progress}vh`);
        hero.style.setProperty("--hero-mobile-y", `${progress * 2}vh`);
        hero.style.setProperty("--hero-mobile-scale", String(1 - progress * 0.08));
        hero.style.setProperty("--hero-mobile-content-y", `${-progress * 3}vh`);
        hero.style.setProperty("--hero-mobile-opacity", String(1 - progress * 0.45));
      });
    };
    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", resetPointer, { passive: true });
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    updateProgress();
    return () => {
      hero.removeEventListener("pointermove", updatePointer);
      hero.removeEventListener("pointerleave", resetPointer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      ["--hero-progress", "--hero-x", "--hero-stage-y", "--hero-scale", "--hero-content-y", "--hero-content-opacity", "--hero-label-x", "--hero-label-y", "--hero-mobile-y", "--hero-mobile-scale", "--hero-mobile-content-y", "--hero-mobile-opacity"].forEach((property) => hero.style.removeProperty(property));
      resetPointer();
    };
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(
      ".observatory-story, .observatory-archive, .observatory-network, .observatory-geography, .observatory-deadlines, .observatory-pulse, .observatory-timeline, .observatory-topics, .observatory-closing",
    );
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const section = entry.target as HTMLElement;
        if (entry.isIntersecting) section.dataset.inView = "true";
        else delete section.dataset.inView;
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Continuous scroll-linked progress for the two sections whose diagrams are
  // meant to *build* as they pass through the viewport: the story instrument
  // (orbit + steps) and the network diagram (paths drawing from body/source/
  // date/place into the decision). Progress is 0 while the section's graphic
  // half is below the fold and 1 when it has passed the middle band, computed
  // per frame in a rAF-throttled scroll/resize listener so reverse scrolling
  // rewinds the drawing exactly. Reduced motion gets the completed drawing.
  useEffect(() => {
    const targets = [
      { section: document.querySelector<HTMLElement>(".observatory-story"), property: "--story-progress" },
      { section: document.querySelector<HTMLElement>(".observatory-network"), property: "--network-progress" },
    ].filter((entry): entry is { section: HTMLElement; property: string } => Boolean(entry.section));
    if (!targets.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewportBand = { start: window.innerHeight * 0.82, end: window.innerHeight * 0.2 };
      for (const { section, property } of targets) {
        const bounds = section.getBoundingClientRect();
        const graphic = bounds.height * 0.55;
        const entered = viewportBand.start - bounds.top;
        const span = graphic + (viewportBand.start - viewportBand.end);
        const progress = Math.min(1, Math.max(0, entered / Math.max(1, span)));
        section.style.setProperty(property, progress.toFixed(3));
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    if (!reducedMotion.matches) {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      update();
    } else {
      targets.forEach(({ section, property }) => section.style.setProperty(property, "1"));
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      targets.forEach(({ section, property }) => section.style.removeProperty(property));
    };
  }, []);

  useEffect(() => {
    const root = stepsRef.current;
    if (!root || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number((visible.target as HTMLElement).dataset.storyStep);
      if (Number.isFinite(index)) setActiveStep(index);
    }, { rootMargin: "-38% 0px -38% 0px", threshold: [0, 0.2, 0.55, 1] });
    root.querySelectorAll<HTMLElement>("[data-story-step]").forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [featureTimeline.length]);

  if (!story) return null;

  const { deadlines } = story;
  if (!featured) return null;
  const steps = featureTimeline;
  const institution = orgNames[featured.organization];
  const currentEvent = steps[Math.min(activeStep, steps.length - 1)];
  const recordedDeferral = steps.find((event) => /defer(?:red|ral)?/i.test(`${event.title} ${event.description}`));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const nextActionIsFuture = Boolean(featured.currentStoryDate && featured.currentStoryDate >= today);
  const actionSource = featured.deadline?.sourceUrl ?? featured.source.url;

  return (
    <>
      <section className="observatory-story" id="record-in-motion" aria-labelledby="story-title">
        <div className="story-intro">
          <p className="observatory-kicker"><span />One public decision, traced</p>
          <h2 id="story-title">A decision is never just a date.</h2>
          <p>Follow a verified {featured.topic.toLowerCase()} record from its public appearances to the document, body, and place it names.</p>
          <span className="story-index">FIELD NOTE&nbsp;&nbsp; 01 / 04</span>
        </div>
        <div className="story-journey">
          <div className="story-instrument" aria-live="polite">
            <div className="story-instrument__top"><span><i /> RECORD IN VIEW</span><span>{String(activeStep + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span></div>
            <div className="story-orbit" aria-hidden="true">
              <span className="story-orbit__ring story-orbit__ring--outer" />
              <span className="story-orbit__ring story-orbit__ring--inner" />
              <span className="story-orbit__core"><Landmark size={27} strokeWidth={1.25} /></span>
              <span className="story-orbit__node story-orbit__node--record"><FileCheck2 size={14} /></span>
              <span className="story-orbit__node story-orbit__node--body"><Landmark size={14} /></span>
              <span className="story-orbit__node story-orbit__node--place"><MapPin size={14} /></span>
              <svg viewBox="0 0 400 300" preserveAspectRatio="none"><path d="M82 84 C135 90 139 131 195 145 M205 150 C278 117 286 103 322 80 M202 166 C248 188 266 218 311 228" /></svg>
            </div>
            <div className="story-instrument__record">
              <p>{institution} · {featured.topic}</p>
              <h3>{featured.title}</h3>
              <span className="story-current-state"><i /> {currentEvent?.title === "First tracked appearance" ? "First recorded appearance" : currentEvent?.stage ?? featured.status} · {currentEvent ? dateLabel(currentEvent.date) : "Verified record"}</span>
              <blockquote key={currentEvent?.id}>{currentEvent?.title === "First tracked appearance"
            ? `First listed on a published ${institution} agenda. The current record status is ${featured.status}.`
            : currentEvent?.description || currentEvent?.title || featured.latestUpdate}</blockquote>
              <Link href={`/decisions/${featured.slug}`}>Open the decision record <ArrowUpRight size={15} /></Link>
            </div>
            <div className="story-instrument__footer"><span>Every connection follows a published record.</span><ArrowDownRight size={15} /></div>
          </div>
          <ol className="story-steps" ref={stepsRef} aria-label="Verified stages in the decision record">
            {steps.map((event, index) => {
              const actionText = `${event.title} ${event.description}`;
              const isDeferral = /\bdefer(?:red|ral)?\b/i.test(actionText) && event.stage !== "Approved";
              const isAgendaAppearance = event.title === "First tracked appearance";
              const eventLabel = isDeferral
                ? "Motion to defer recorded"
                : isAgendaAppearance
                  ? "Agenda appearance"
                  : event.stage;
              const stageDetail = isDeferral
                ? `The official record describes a motion to defer. CivicLens preserves the source's stage label, ${event.stage}, without treating the motion text as a certified final outcome.`
                : isAgendaAppearance
                  ? `This item appears on a ${institution} agenda; an agenda listing alone does not establish what action occurred.`
                  : event.description;
              return (
              <li key={event.id} data-story-step={index} className={index === activeStep ? "is-active" : index < activeStep ? "is-past" : ""}>
                <span className="story-step-marker"><i /></span>
                <div className="story-step-copy">
                  <p>{dateLabel(event.date, { month: "short", day: "numeric", year: "numeric" })}<span> · {event.verificationStatus === "verified" ? "Official record" : "Record"}</span></p>
                  <h3>{eventLabel}</h3>
                  <p className="story-step-detail">{stageDetail}</p>
                  <Link href={`/decisions/${featured.slug}`} aria-label={`Open the record for ${eventLabel}`}>Trace this stage <ArrowRight size={14} /></Link>
                </div>
              </li>
              );
            })}
          </ol>
        </div>
        <div className="story-source-note"><span><FileCheck2 size={15} /> Source verified {featured.source.lastVerifiedAt ? dateLabel(featured.source.lastVerifiedAt, { month: "short", day: "numeric", year: "numeric" }) : "against the official record"}</span><a href={featured.source.url} target="_blank" rel="noreferrer noopener">{featured.source.title}<ArrowUpRight size={13} /></a></div>
      </section>

      <section className="observatory-archive" aria-labelledby="archive-title">
        <div className="archive-copy">
          <p className="observatory-kicker"><span />The source, in full view</p>
          <h2 id="archive-title">Start with the record.</h2>
          <p>This is an editorial rendering of the verified source, not a scan. The published document remains one click away, alongside the language CivicLens can substantiate.</p>
          <a className="archive-open" href={featured.source.url} target="_blank" rel="noreferrer noopener">Read the official source <ArrowUpRight size={16} /></a>
          <dl className="archive-meta">
            <div><dt>Issuing body</dt><dd>{featured.source.organization || institution}</dd></div>
            <div><dt>Document</dt><dd>{featured.source.title}</dd></div>
            {featured.source.publishedAt ? <div><dt>Published</dt><dd>{dateLabel(featured.source.publishedAt)}</dd></div> : null}
            <div><dt>Record status</dt><dd><span className="verified-dot" /> {featured.source.verificationStatus === "verified" ? "Verified source" : "Unconfirmed source"}</dd></div>
          </dl>
        </div>
        <article className="archive-document" aria-label="Editorial rendering of the verified public record">
          <div className="archive-document__edge" />
          <div className="archive-document__masthead"><span>EDITORIAL RENDERING&nbsp; / &nbsp;{institution.toUpperCase()}</span><FileCheck2 size={18} /></div>
          <p className="archive-document__serial">CIVICLENS RECORD&nbsp;&nbsp; · &nbsp;&nbsp;{featured.id}</p>
          <h3>{featured.title}</h3>
          <p className="archive-document__topic">{featured.topic} &nbsp; / &nbsp; {featured.status}</p>
          <div className="archive-document__rule" />
          <p className="archive-document__excerpt">{featured.summary}</p>
          {recordedDeferral ? <blockquote className="archive-document__excerpt">Meeting action recorded {dateLabel(recordedDeferral.date)}: {recordedDeferral.description}</blockquote> : null}
          <div className="archive-document__lines" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="archive-document__stamp"><span>EDITORIAL</span><span>RENDERING</span><FileCheck2 size={24} /></div>
          <footer><span>Source: {featured.source.title}</span><span>{featured.source.publishedAt ? dateLabel(featured.source.publishedAt, { month: "short", day: "numeric", year: "numeric" }) : "Source date not stated"}</span></footer>
        </article>
      </section>

      <section className="observatory-network" aria-labelledby="network-title">
        <div className="network-copy">
          <p className="observatory-kicker"><span />The decision network</p>
          <h2 id="network-title">One record.<br />Four public connections.</h2>
          <p>These are fields attached to this decision—not inferred influence: the body handling it, the verified source, the scheduled action, and the exact jurisdiction on record.</p>
          <div className="network-key"><span><i /> Verified connection</span><span>Source links open the official record</span></div>
        </div>
        <div className="network-diagram" aria-label="Connections documented on this decision">
          <svg viewBox="0 0 720 430" aria-hidden="true">
            <path className="network-link network-link--top" d="M360 214 C348 130 245 100 165 85" />
            <path className="network-link network-link--right" d="M390 205 C470 164 508 139 568 104" />
            <path className="network-link network-link--bottom" d="M377 238 C398 306 477 329 552 346" />
            <path className="network-link network-link--left" d="M330 224 C255 267 205 313 139 337" />
            <circle className="network-ring" cx="360" cy="216" r="89" />
          </svg>
          <Link className="network-node network-node--center" href={`/decisions/${featured.slug}`}><span><Waypoints size={19} /></span><small>THE DECISION</small><strong>{featured.title}</strong><i><ArrowUpRight size={14} /></i></Link>
          <a className="network-node network-node--body" href={featured.source.url} target="_blank" rel="noreferrer noopener"><span><Landmark size={16} /></span><small>PUBLIC BODY</small><strong>{institution}</strong><i><ArrowUpRight size={13} /></i></a>
          <a className="network-node network-node--source" href={featured.source.url} target="_blank" rel="noreferrer noopener"><span><FileCheck2 size={16} /></span><small>VERIFIED SOURCE</small><strong>{featured.source.title}</strong><i><ArrowUpRight size={13} /></i></a>
          {nextActionIsFuture ? <a className="network-node network-node--date" href={actionSource} target="_blank" rel="noreferrer noopener"><span><CalendarClock size={16} /></span><small>PUBLISHED ACTION DATE</small><strong>{dateLabel(featured.currentStoryDate!)} · {featured.deadline?.label ?? featured.deadline?.officialStatus ?? featured.status}</strong><i><ArrowUpRight size={13} /></i></a> : <div className="network-node network-node--date"><span><CalendarClock size={16} /></span><small>NEXT ACTION DATE</small><strong>No upcoming date in the record</strong><i aria-hidden="true"><ArrowUpRight size={13} /></i></div>}
          {featured.geography?.confidence === "exact" ? <Link className="network-node network-node--place" href={locationHref}><span><MapPin size={16} /></span><small>JURISDICTION</small><strong>{featured.geography.councilDistrict ? `City Council District ${featured.geography.councilDistrict}` : featured.geography.zipCode ? `ZIP ${featured.geography.zipCode}` : district?.label ?? "Confirmed location"}</strong><i><ArrowUpRight size={13} /></i></Link> : <div className="network-node network-node--place"><span><MapPin size={16} /></span><small>JURISDICTION</small><strong>Location not confirmed</strong></div>}
        </div>
      </section>

      <section className="observatory-geography" aria-labelledby="geography-title">
        <div className="geography-map">
          {district && mapLayout.path ? <>
            <div className="geography-map__grid" aria-hidden="true" />
            <svg viewBox="0 0 420 300" role="img" aria-label={`${district.label}, from the county's official boundary layer`}>
              <path className="geography-boundary-shadow" d={mapLayout.path} />
              <path className="geography-boundary" d={mapLayout.path} />
              {mapLayout.point ? <>
                <circle cx={mapLayout.point.x} cy={mapLayout.point.y} r="28" className="geography-focus-ring" />
                <circle cx={mapLayout.point.x} cy={mapLayout.point.y} r="5" className="geography-point" />
                <text x={mapLayout.point.x + 12} y={mapLayout.point.y - 9}>RECORD LOCATION</text>
              </> : null}
            </svg>
            <span className="geography-map__label">{district.label}</span>
            <a className="geography-attribution" href={district.sourceUrl} target="_blank" rel="noreferrer noopener">Official boundary · Mecklenburg County GIS <ArrowUpRight size={12} /></a>
          </> : <div className="geography-unconfirmed"><MapPin size={25} /><strong>Location not confirmed</strong><span>This record does not have a verified district boundary.</span></div>}
        </div>
        <div className="geography-copy">
          <p className="observatory-kicker"><span />A place with a boundary</p>
          <h2 id="geography-title">Where this decision lands.</h2>
          <p>{district ? `The record carries an exact location in ${district.label}. The outline comes from Mecklenburg County's published GIS boundary; the point comes from the decision record.` : "CivicLens does not place this record on a map without a confirmed location and an official boundary."}</p>
          <dl className="geography-facts">
            <div><dt>Public body</dt><dd>{institution}</dd></div>
            {featured.geography?.zipCode ? <div><dt>ZIP on record</dt><dd>{featured.geography.zipCode}</dd></div> : null}
            {featured.geography?.councilDistrict ? <div><dt>City Council district</dt><dd>{featured.geography.councilDistrict}</dd></div> : null}
            <div><dt>Location confidence</dt><dd>{featured.geography?.confidence === "exact" ? "Exact · record matched" : "Not confirmed"}</dd></div>
          </dl>
          <Link className="archive-open" href={locationHref}>Explore this area <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="observatory-deadlines" aria-labelledby="story-deadline-title">
        <header className="deadline-story-heading"><div><p className="observatory-kicker"><span />The public calendar</p><h2 id="story-deadline-title">What happens next.</h2></div><Link href="/deadlines">All published dates <ArrowUpRight size={15} /></Link></header>
        {deadlines.length ? <ol className="deadline-story-list">{deadlines.map((item) => (
          <li key={item.slug}>
            <Link className="deadline-story-date" href={`/decisions/${item.slug}`}><span>{dateLabel(item.date, { month: "short" })}</span><strong>{dateLabel(item.date, { day: "numeric" })}</strong><small>{dateLabel(item.date, { year: "numeric" })}</small></Link>
            <div className="deadline-story-copy"><p>{item.organization ? orgNames[item.organization] : institution}{item.scope ? ` · ${item.scope}` : ""}</p><h3><Link href={`/decisions/${item.slug}`}>{item.title}</Link></h3><span>{item.label} · {item.status}</span></div>
            {item.sourceUrl ? <a className="deadline-story-source" href={item.sourceUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open published source for ${item.title}`}><ArrowUpRight size={17} /></a> : <Link className="deadline-story-source" href={`/decisions/${item.slug}`} aria-label={`Open record for ${item.title}`}><ArrowUpRight size={17} /></Link>}
          </li>
        ))}</ol> : <p className="deadline-story-empty">No future action date is currently stated in a verified source. CivicLens does not estimate one.</p>}
        <p className="deadline-story-note"><CalendarClock size={14} /> Dates are read from verified government records. Past or inferred dates are not presented as upcoming.</p>
      </section>

    </>
  );
}

export function ObservatoryClosing({ story }: { story: ObservatoryStory | null }) {
  const featured = story?.featured;
  if (!featured) return null;
  const institution = featured.source.organization || orgNames[featured.organization];
  return (
    <section className="observatory-closing" aria-labelledby="closing-title">
      <p className="observatory-kicker"><span />The record stays open</p>
      <h2 id="closing-title">Follow the decision.<br /><em>See what changes next.</em></h2>
      <p>CivicLens connects public decisions to the records, dates, institutions, and places behind them. When the source does not say, we leave it blank.</p>
      <div><Link className="observatory-button observatory-button--primary" href={`/decisions/${featured.slug}`}>Read this decision <ArrowRight size={16} /></Link><Link className="observatory-button observatory-button--secondary" href="/explore">Explore the public index</Link></div>
      <span className="closing-source">Illustrated record · verified source · {institution}</span>
    </section>
  );
}
