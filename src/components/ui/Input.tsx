import { cn } from "@/lib/utils/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className, error, id, ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        id={id}
        className={cn(
          "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900",
          "placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20",
          "min-h-[44px]",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
