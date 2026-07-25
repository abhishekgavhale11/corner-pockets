import type { CafeItemType } from "@/lib/constants/cafe";
import { cn } from "@/lib/utils/cn";

const ICON_WRAP: Record<CafeItemType, string> = {
  CIGARETTE: "bg-emerald-100 text-emerald-700",
  WATER: "bg-sky-100 text-sky-700",
  COLD_DRINK: "bg-violet-100 text-violet-700",
  FOOD: "bg-orange-100 text-orange-700",
};

export function CafeItemTypeIcon({
  type,
  className,
}: {
  type: CafeItemType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        ICON_WRAP[type],
        className
      )}
      aria-hidden
    >
      {type === "CIGARETTE" && <CigaretteIcon />}
      {type === "WATER" && <WaterIcon />}
      {type === "COLD_DRINK" && <ColdDrinkIcon />}
      {type === "FOOD" && <FoodIcon />}
    </span>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function CigaretteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="10"
        width="14"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M17 11h2.5a1.5 1.5 0 0 1 0 3H17"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10v5M11 10v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20.5 8c.5-.8.5-1.5 0-2.2M22 6.5c.4-.7.4-1.3 0-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WaterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 8h6l1 3v7a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-7l1-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 8V6.5A1.5 1.5 0 0 1 11.5 5h1A1.5 1.5 0 0 1 14 6.5V8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ColdDrinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8l-1 16H9L8 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8h8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2M10 3l1 1M14 3l-1 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M8 13v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M16 3v18M16 3c2 2 2 5 0 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
