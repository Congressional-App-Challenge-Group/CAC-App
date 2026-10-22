"use client";

import { useEffect } from "react";

/**
 * Opening choreography for the observatory hero, plus the scroll-driven camera
 * retreat for the 3D scene.
 *
 * The page is fully visible without JavaScript: `data-hero-animated` is only set
 * on the hero after hydration, and every entrance animation is gated behind that
 * attribute in CSS. Reduced-motion users get the composed page immediately —
 * the hook bails before touching the DOM.
 *
 * The same rAF loop publishes `--hero-progress` (0..1 as the hero scrolls out)
 * and drives the Three.js camera pull-back through a shared dataset attribute,
 * so the sculpture recedes into the scene instead of merely translating.
 */
export function useHeroChoreography() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".observatory-hero");
    if (!hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let cleanupScene = () => {};

    if (!reducedMotion.matches) {
      const stage = hero.querySelector<HTMLElement>(".observatory-stage");
      // Let the first paint land before triggering entrances, so the animation
      // runs from the composed state rather than the load state.
      const revealTimer = window.setTimeout(() => {
        hero.setAttribute("data-hero-animated", "true");
      }, 80);

      const advance = () => {
        const stageScene = stage?.firstElementChild as HTMLElement | null;
        if (stageScene) {
          stageScene.dataset.cameraRetreat = hero.dataset.heroProgress ?? "0";
        }
      };

      const loop = () => {
        advance();
        frame = window.requestAnimationFrame(loop);
      };
      frame = window.requestAnimationFrame(loop);

      cleanupScene = () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(revealTimer);
        const stageScene = stage?.firstElementChild as HTMLElement | null;
        if (stageScene) delete stageScene.dataset.cameraRetreat;
        hero.removeAttribute("data-hero-animated");
      };
    }

    return () => cleanupScene();
  }, []);
}
