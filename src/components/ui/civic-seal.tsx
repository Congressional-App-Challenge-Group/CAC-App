import type { SVGProps } from "react";

/** A hand-drawn civic seal; decorative contours echo a surveyor's map. */
export function CivicSeal({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 360 360" fill="none" aria-hidden="true" className={className} {...rest}>
      <circle cx="180" cy="180" r="164" stroke="currentColor" strokeOpacity=".28" />
      <circle cx="180" cy="180" r="151" stroke="currentColor" strokeOpacity=".18" />
      <path
        d="M180 16v28M180 316v28M16 180h28M316 180h28M64 64l20 20M276 276l20 20M296 64l-20 20M84 276l-20 20"
        stroke="currentColor" strokeOpacity=".32"
      />
      <path
        d="M180 62c-44 44-57 85-37 122 15 27 42 41 77 43-12-32-5-58 19-77-6-28-24-58-59-88Z"
        fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2"
      />
      <path
        d="M146 189c-13-26-11-54 9-83m27-40c30 28 45 56 45 84m-84 39c17 16 42 26 75 28m-37-95 22 17-5 28 25 14"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".7"
      />
      <circle cx="180" cy="180" r="5" fill="currentColor" />
      <circle cx="242" cy="150" r="4" fill="currentColor" />
      <circle cx="133" cy="132" r="4" fill="currentColor" />
      <circle cx="217" cy="227" r="4" fill="currentColor" />
      <path d="M95 248c25 22 53 34 85 36m86-36c-25 22-53 34-85 36" stroke="currentColor" strokeOpacity=".28" />
      <text x="180" y="324" textAnchor="middle" fill="currentColor" fillOpacity=".62" fontSize="11" letterSpacing="3" fontFamily="sans-serif">
        CHARLOTTE · MECKLENBURG
      </text>
    </svg>
  );
}
