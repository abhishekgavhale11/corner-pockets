import Link from "next/link";
import { historyUi } from "@/components/business-day/history/tokens";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

interface CustomerCellProps {
  name: string;
  href?: string;
  secondary?: string;
  compact?: boolean;
}

export function CustomerCell({
  name,
  href,
  secondary,
  compact = false,
}: CustomerCellProps) {
  const title = href ? (
    <Link
      href={href}
      className={`block truncate font-semibold leading-tight text-gray-900 hover:text-emerald-800 ${
        compact ? "text-[13px]" : "text-[14px]"
      }`}
    >
      {name}
    </Link>
  ) : (
    <p
      className={`truncate font-semibold leading-tight text-gray-900 ${
        compact ? "text-[13px]" : "text-[14px]"
      }`}
    >
      {name}
    </p>
  );

  return (
    <div className={`flex min-w-0 items-center ${compact ? "gap-2" : "gap-3"}`}>
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100 ${
          compact
            ? "h-6 w-6 text-[9px]"
            : "h-8 w-8 text-[10px]"
        }`}
        aria-hidden
      >
        {initials(name)}
      </span>
      <div className="min-w-0">
        {title}
        {secondary ? (
          <p className={`truncate ${historyUi.metadata}`}>{secondary}</p>
        ) : null}
      </div>
    </div>
  );
}
