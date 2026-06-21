import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  query?: string;
}

export function Pagination({ page, totalPages, query }: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", p.toString());
    return `/customers?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <p className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)}>
            <Button variant="secondary" size="sm">
              Previous
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)}>
            <Button variant="secondary" size="sm">
              Next
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
