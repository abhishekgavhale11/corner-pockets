"use client";

import { cn } from "@/lib/utils/cn";

interface RowActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "cafe" | "edit";
  className?: string;
}

export function RowActionButton({
  label,
  onClick,
  disabled = false,
  variant = "edit",
  className,
}: RowActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-bold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "cafe"
          ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
          : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
        className
      )}
    >
      {label}
    </button>
  );
}
