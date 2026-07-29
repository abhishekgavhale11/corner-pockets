import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function HistoryIconChart(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4" {...props}>
      <path
        d="M4 19V9M10 19V5M16 19v-7M22 19H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HistoryIconCash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4" {...props}>
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function HistoryIconOutstanding(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4" {...props}>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.3 3.1 7.4 7.5 8.3 4.4-.9 7.5-4 7.5-8.3V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HistoryIconCalendar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4" {...props}>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
