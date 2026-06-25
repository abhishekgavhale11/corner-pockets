"use client";

import { cn } from "@/lib/utils/cn";

interface CafeQuickButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function CafeQuickButton({
  onClick,
  disabled = false,
  className,
}: CafeQuickButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
    >
      Cafe
    </button>
  );
}
