"use client";

import { Bell, BellRing } from "lucide-react";
import { usePreferences } from "@/features/preferences/preferences";
import { placeKey, type PlaceDistrict } from "@/lib/place";
import { cn } from "@/lib/cn";

/**
 * Follow a district.
 *
 * A resident rarely cares about one agenda item; they care about a place — the
 * block being rezoned, the school boundary at the end of the road. Following a
 * district means every matter that lands in it is already on their list.
 *
 * The stored value is the same `kind:code` key a shared district link uses, so a
 * followed place and a link a neighbour sends are the same thing.
 */
export function FollowPlaceButton({
  district,
  className,
}: {
  district: Pick<PlaceDistrict, "kind" | "code" | "label">;
  className?: string;
}) {
  const { followingPlaces, toggleFollowPlace } = usePreferences();
  const key = placeKey(district.kind, district.code);
  const followed = followingPlaces.includes(key);

  return (
    <button
      type="button"
      onClick={() => toggleFollowPlace(key)}
      aria-pressed={followed}
      title={followed ? `Stop following ${district.label}` : `Follow ${district.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-extrabold transition-colors",
        followed ? "text-civic" : "text-muted hover:text-ink",
        className,
      )}
    >
      {followed ? <BellRing size={13} aria-hidden="true" /> : <Bell size={13} aria-hidden="true" />}
      {followed ? "Following" : "Follow"}
    </button>
  );
}
