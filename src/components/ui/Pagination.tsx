import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  query?: string;
  filter?: string;
}

function buildHref(
  page: number,
  query?: string,
  filter?: string,
  limit?: number
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter && filter !== "all") params.set("filter", filter);
  if (limit && limit !== 10) params.set("limit", String(limit));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/customers?${qs}` : "/customers";
}

function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("…");
    }
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  query,
  filter,
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = pageWindow(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-500">
        Showing{" "}
        <span className="font-medium tabular-nums text-gray-700">
          {from} to {to}
        </span>{" "}
        of{" "}
        <span className="font-medium tabular-nums text-gray-700">{total}</span>{" "}
        customers
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <Link
            href={buildHref(Math.max(1, page - 1), query, filter, limit)}
            aria-disabled={page <= 1}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50",
              page <= 1 && "pointer-events-none opacity-40"
            )}
          >
            ‹
          </Link>
          {pages.map((item, index) =>
            item === "…" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1.5 text-sm text-gray-400"
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={buildHref(item, query, filter, limit)}
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold tabular-nums",
                  item === page
                    ? "bg-emerald-800 text-white"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                {item}
              </Link>
            )
          )}
          <Link
            href={buildHref(Math.min(totalPages, page + 1), query, filter, limit)}
            aria-disabled={page >= totalPages}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50",
              page >= totalPages && "pointer-events-none opacity-40"
            )}
          >
            ›
          </Link>
        </div>
      ) : null}
    </div>
  );
}
