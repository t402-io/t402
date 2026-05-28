import * as React from "react";

export interface T402LogoProps extends React.SVGProps<SVGSVGElement> {
  title?: string;
}

/**
 * T402 wordmark — pure typography. Renders "T402" via SVG <text>
 * using the Source Serif 4 stack with sensible fallbacks. Uses
 * `currentColor` so it inherits ink in NavBar (light bg) and cream
 * in Footer (dark bg).
 *
 * Replaces the previous gem-with-₮ device mark for trademark
 * distance from Tether (no Tether-inspired styling per the
 * 2026-05-17 pivot lock).
 */
export function T402Logo({ title, className, ...props }: T402LogoProps) {
  return (
    <svg
      viewBox="0 0 95 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      className={className}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <text
        x="0"
        y="24"
        fontFamily="var(--font-source-serif), 'Source Serif 4', Georgia, 'Iowan Old Style', serif"
        fontSize="26"
        fontWeight="500"
        letterSpacing="-0.5"
        fill="currentColor"
        textRendering="geometricPrecision"
      >
        T402
      </text>
    </svg>
  );
}
