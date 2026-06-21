"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Input } from "@/components/ui/Input";

export function CustomerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    const currentQ = searchParams.get("q") ?? "";
    if (trimmed === currentQ) return;

    const params = new URLSearchParams();
    if (trimmed) {
      params.set("q", trimmed);
    }

    startTransition(() => {
      router.replace(trimmed ? `/customers?${params.toString()}` : "/customers");
    });
  }, [debouncedQuery, router, searchParams]);

  return (
    <div className="relative">
      <Input
        type="search"
        placeholder="Search by name, phone, or card ID..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full"
        aria-label="Search customers"
      />
      {isPending && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Searching...
        </span>
      )}
    </div>
  );
}
