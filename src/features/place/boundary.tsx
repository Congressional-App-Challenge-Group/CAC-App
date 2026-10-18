"use client";

import { useEffect, useState } from "react";
import { placeKey, type PlaceDistrict } from "@/lib/place";
import type { MapShape } from "@/components/ui/map";

/**
 * The outline of one district, fetched when it is needed.
 *
 * The reader's address resolves to up to seven nested districts, and drawing all
 * of them at once would be seven overlapping polygons on one picture — the ZIP
 * over the council district over the county over the state. So one district is
 * drawn at a time, chosen by the reader, and only that one is fetched.
 *
 * The three outcomes are kept distinct rather than collapsed into "no outline":
 * a district the county publishes no geometry for is a gap in the source, and
 * saying so is the same honesty the rest of the product applies to its records.
 */

export type BoundaryState = {
  status: "idle" | "loading" | "ready" | "absent" | "error";
  shape?: MapShape;
  note?: string;
};

type BoundaryResponse =
  | {
      ok: true;
      kind: string;
      code: string;
      label: string;
      rings: number[][][];
      sourceUrl?: string;
    }
  | { ok: false; reason: string; message: string };

export function useBoundary(district: PlaceDistrict | null): BoundaryState {
  const [state, setState] = useState<BoundaryState>({ status: "idle" });
  const kind = district?.kind;
  const code = district?.code;

  useEffect(() => {
    if (!kind || !code) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const response = await fetch(
          `/api/place/boundary?kind=${encodeURIComponent(kind)}&code=${encodeURIComponent(code)}`,
        );
        const result = (await response.json()) as BoundaryResponse;
        if (cancelled) return;

        if (result.ok) {
          setState({
            status: "ready",
            shape: {
              id: placeKey(kind, code),
              rings: result.rings,
              label: result.label,
              tone: "accent",
            },
          });
        } else {
          setState({ status: "absent", note: result.message });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", note: "The district outline could not be loaded." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, code]);

  return state;
}
