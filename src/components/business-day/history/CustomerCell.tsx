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
}

export function CustomerCell({ name, href, secondary }: CustomerCellProps) {
  const title = href ? (
    <Link
      href={href}
      className="block truncate text-[14px] font-semibold leading-tight text-gray-900 hover:text-emerald-800"
    >
      {name}
    </Link>
  ) : (
    <p className="truncate text-[14px] font-semibold leading-tight text-gray-900">
      {name}
    </p>
  );

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100"
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
