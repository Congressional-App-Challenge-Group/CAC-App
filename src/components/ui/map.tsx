"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TILE_SIZE, projectMercator, unprojectMercator } from "@/lib/geography";
import { cn } from "@/lib/cn";

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  href?: string;
  tone?: "default" | "accent";
};

type Props = {
  center: { latitude: number; longitude: number };
  zoom?: number;
  points?: MapPoint[];
  height?: number;
  interactive?: boolean;
  className?: string;
  /** Highlights one marker, e.g. on a decision page. */
  activeId?: string;
};

const MIN_ZOOM = 9;
const MAX_ZOOM = 17;

function tileUrl(x: number, y: number, z: number) {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/**
 * A small slippy map built directly on Web Mercator maths rather than pulling
 * in a mapping library, so the project gains a real geographic view without a
 * new dependency.
 *
 * Tile source note: these are public OpenStreetMap tiles, which are fine for
 * low-volume use but are not a production tile service. Swapping `tileUrl` for
 * a hosted provider (or a self-hosted tile server) is the only change needed.
 */
export function MiniMap({
  center,
  zoom: initialZoom = 13,
  points = [],
  height = 320,
  interactive = true,
  className,
  activeId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height });
  const [zoom, setZoom] = useState(initialZoom);
  const [view, setView] = useState(center);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Reset the view when the caller hands us a different centre.
  useEffect(() => {
    setView(center);
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  const { originX, originY } = useMemo(() => {
    const projected = projectMercator(view.latitude, view.longitude, zoom);
    return {
      originX: projected.x - size.width / 2,
      originY: projected.y - size.height / 2,
    };
  }, [view.latitude, view.longitude, zoom, size.width, size.height]);

  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const minX = Math.floor(originX / TILE_SIZE);
    const maxX = Math.floor((originX + size.width) / TILE_SIZE);
    const minY = Math.floor(originY / TILE_SIZE);
    const maxY = Math.floor((originY + size.height) / TILE_SIZE);
    const max = 2 ** zoom;
    const list: { key: string; url: string; left: number; top: number }[] = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= max) continue;
        const wrappedX = ((x % max) + max) % max;
        list.push({
          key: `${zoom}/${x}/${y}`,
          url: tileUrl(wrappedX, y, zoom),
          left: x * TILE_SIZE - originX,
          top: y * TILE_SIZE - originY,
        });
      }
    }
    return list;
  }, [originX, originY, size.width, size.height, zoom]);

  const markers = useMemo(() => {
    return points.map((point) => {
      const projected = projectMercator(point.latitude, point.longitude, zoom);
      return {
        ...point,
        left: projected.x - originX,
        top: projected.y - originY,
      };
    });
  }, [points, originX, originY, zoom]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      dragRef.current = { x: event.clientX, y: event.clientY };
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    },
    [interactive],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !dragRef.current) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      if (dx === 0 && dy === 0) return;
      dragRef.current = { x: event.clientX, y: event.clientY };
      const projected = projectMercator(view.latitude, view.longitude, zoom);
      setView(unprojectMercator(projected.x - dx, projected.y - dy, zoom));
    },
    [interactive, view.latitude, view.longitude, zoom],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const zoomBy = (delta: number) => {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta)));
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-3",
        interactive && "cursor-grab active:cursor-grabbing touch-none",
        className,
      )}
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      role="img"
      aria-label={`Map showing ${points.length} location${points.length === 1 ? "" : "s"}`}
    >
      {tiles.map((tile) => (
        // Plain <img> keeps this independent of next/image remote config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          width={TILE_SIZE}
          height={TILE_SIZE}
          draggable={false}
          loading="lazy"
          className="pointer-events-none absolute select-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      {markers.map((marker) => {
        const active = marker.id === activeId;
        const pin = (
          <span
            className={cn(
              "block h-3.5 w-3.5 rounded-full border-2 border-surface shadow-md transition-transform",
              marker.tone === "accent" || active ? "bg-amber" : "bg-civic",
              active && "scale-150",
            )}
          />
        );
        return (
          <div
            key={marker.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: marker.left, top: marker.top }}
            title={marker.label}
          >
            {marker.href ? (
              <Link href={marker.href} aria-label={marker.label} className="block p-1.5">
                {pin}
              </Link>
            ) : (
              <span className="block p-1.5">{pin}</span>
            )}
          </div>
        );
      })}

      {interactive ? (
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => zoomBy(1)}
            aria-label="Zoom in"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-lg font-black leading-none text-ink shadow-sm hover:bg-surface-2"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            aria-label="Zoom out"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-lg font-black leading-none text-ink shadow-sm hover:bg-surface-2"
          >
            −
          </button>
        </div>
      ) : null}

      <p className="absolute bottom-0 right-0 rounded-tl-md bg-surface/85 px-1.5 py-0.5 text-[9px] text-subtle">
        © OpenStreetMap contributors
      </p>
    </div>
  );
}
