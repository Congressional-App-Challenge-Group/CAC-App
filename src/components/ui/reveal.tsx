"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Fades content in as it scrolls into view. Degrades to visible when
 *  IntersectionObserver is unavailable and respects reduced-motion via CSS. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", shown && "reveal-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Adds lightweight scroll reveals and pointer tilt to shared content pages. */
export function PageMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("#main");
    if (!main || main.querySelector(".observatory-hero") || typeof IntersectionObserver === "undefined") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute("data-scroll-revealed", "true");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    const observed = new WeakSet<Element>();
    const revealTargets = [
      ".page-heading",
      ".deadline-overview",
      ".deadline-list > li",
      ".explore-console",
      ".explore-results",
      ".explore-grid > *",
      ".shell > section",
      ".shell > .grid > *",
      ".decision-card",
      "section",
      "article",
      ".card",
    ].join(",");

    const observeTargets = () => {
      main.querySelectorAll<HTMLElement>(revealTargets).forEach((element, index) => {
        if (observed.has(element)) return;
        observed.add(element);
        element.setAttribute("data-scroll-reveal", "true");
        element.style.setProperty("--scroll-reveal-delay", `${Math.min(index % 5, 3) * 65}ms`);
        revealObserver.observe(element);
      });
    };

    main.setAttribute("data-scroll-motion", "ready");
    observeTargets();
    const contentObserver = new MutationObserver(observeTargets);
    contentObserver.observe(main, { childList: true, subtree: true });

    let activeCard: HTMLElement | null = null;
    const clearCard = (card: HTMLElement) => {
      card.style.removeProperty("--card-tilt-x");
      card.style.removeProperty("--card-tilt-y");
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || window.matchMedia("(hover: none)").matches) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".decision-card") : null;
      if (!target || !main.contains(target)) {
        if (activeCard) clearCard(activeCard);
        activeCard = null;
        return;
      }
      const bounds = target.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      if (activeCard && activeCard !== target) clearCard(activeCard);
      activeCard = target;
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      target.style.setProperty("--card-tilt-x", `${-y * 3}deg`);
      target.style.setProperty("--card-tilt-y", `${x * 3}deg`);
    };
    const onPointerLeave = () => {
      if (activeCard) clearCard(activeCard);
      activeCard = null;
    };
    main.addEventListener("pointermove", onPointerMove, { passive: true });
    main.addEventListener("pointerleave", onPointerLeave);

    return () => {
      contentObserver.disconnect();
      revealObserver.disconnect();
      main.removeAttribute("data-scroll-motion");
      main.querySelectorAll<HTMLElement>("[data-scroll-reveal]").forEach((element) => {
        element.removeAttribute("data-scroll-reveal");
        element.removeAttribute("data-scroll-revealed");
        element.style.removeProperty("--scroll-reveal-delay");
      });
      if (activeCard) clearCard(activeCard);
      main.removeEventListener("pointermove", onPointerMove);
      main.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [pathname]);

  return null;
}
