"use client";

import { Printer } from "lucide-react";

/**
 * The District Brief's print affordance.
 *
 * A separate client component because browser printing is an event, and the
 * brief itself is a Server Component so its data stays server-rendered. Falls
 * back to the browser's own print menu when scripting is unavailable; the
 * brief prints correctly either way through the print stylesheet.
 */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
      <Printer size={16} /> Print / save as PDF
    </button>
  );
}
