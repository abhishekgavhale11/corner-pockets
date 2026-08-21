"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function CustomerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (debouncedQuery !== query) return;

    const trimmed = debouncedQuery.trim();
    const currentQ = searchParams.get("q") ?? "";
    if (trimmed === currentQ) return;

    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    params.delete("page");

    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/customers?${qs}` : "/customers");
    });
  }, [debouncedQuery, query, router, searchParams]);

  return (
    <div className="relative min-w-0 flex-1">
      <span
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        placeholder="Search by name or mobile number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-[42px] w-full rounded-[11px] border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 shadow-sm shadow-gray-900/5 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        aria-label="Search customers"
      />
      {isPending ? (
        <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-gray-400">
          …
        </span>
      ) : null}
    </div>
  );
}
