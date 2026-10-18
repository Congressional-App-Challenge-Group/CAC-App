import { Landmark } from "lucide-react";
import type { Decision } from "@/types";
import { decisionPlaceCodes, placeKindMeta, type PlaceKind } from "@/lib/place";
import { Surface } from "@/components/ui/card";

/**
 * Which districts contain this record.
 *
 * Server-rendered from the codes already stored on the record, so it needs no
 * geometry and works identically in the static deployment and against Supabase.
 *
 * The panel deliberately does not say "your representatives": CivicLens does not
 * know where the reader lives on the record page. It names the district and who
 * holds it, and leaves the comparison to the reader — which is also why the
 * "is this yours?" question belongs to the address lookup rather than here.
 */
export function DistrictPanel({ decision }: { decision: Decision }) {
  const codes = decisionPlaceCodes(decision.geography);
  const entries = (Object.keys(codes) as PlaceKind[]).filter((kind) => kind !== "zip");

  if (!entries.length) {
    return (
      <Surface className="p-5 text-sm">
        <div className="flex items-center gap-2 font-extrabold text-ink">
          <Landmark size={17} className="text-civic" aria-hidden="true" />
          Which district decides this
        </div>
        <p className="mt-3 leading-6 text-muted">
          The official record does not state a location this could be placed from, so no district can
          be named. That is the honest answer rather than an assigned one.
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="p-5 text-sm">
      <div className="flex items-center gap-2 font-extrabold text-ink">
        <Landmark size={17} className="text-civic" aria-hidden="true" />
        Which district decides this
      </div>

      <ul className="mt-4 space-y-3 border-t border-line pt-4">
        {entries.map((kind) => (
          <li key={kind}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle">
              {placeKindMeta[kind].name}
            </p>
            <p className="mt-1 font-bold text-ink">
              {placeKindMeta[kind].body}
              <span className="ml-1.5 font-normal text-muted">District {codes[kind]}</span>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-subtle">
        Districts come from Mecklenburg County&apos;s published boundary layers. Enter your own
        address on <span className="font-bold">My area</span> to see which of them are yours.
      </p>
    </Surface>
  );
}
