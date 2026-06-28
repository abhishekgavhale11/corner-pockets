import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon: ReactNode;
  title: string;
  description?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-center",
        compact ? "px-4 py-4" : "px-4 py-8",
        className
      )}
      {...props}
    >
      <div
        className="flex h-8 w-8 items-center justify-center text-gray-400"
        aria-hidden
      >
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-700">{title}</p>
      {description ? (
        <p className="mt-2 text-sm font-medium text-gray-500">{description}</p>
      ) : null}
    </div>
  );
}
