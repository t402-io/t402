import * as React from "react";

export interface T402LogoProps extends React.SVGProps<SVGSVGElement> {
  title?: string;
}

export function T402Logo({ title, ...props }: T402LogoProps) {
  return (
    <svg
      viewBox="0 0 400 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {/* Gem icon — brand teal with white ₮ symbol */}
      <g transform="translate(10, 5) scale(0.21)">
        <path d="M135 60H377L465 210L256 460L47 210L135 60Z" fill="#009393" />
        <rect x="176" y="145" width="160" height="35" fill="white" />
        <rect x="236" y="180" width="40" height="130" fill="white" />
        <ellipse cx="256" cy="215" rx="105" ry="30" stroke="white" strokeWidth="12" fill="none" />
      </g>
      {/* T402 text */}
      <text
        x="140"
        y="75"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
        fontSize="52"
        fontWeight="700"
        fill="currentColor"
        letterSpacing="-1"
      >
        T402
      </text>
    </svg>
  );
}
