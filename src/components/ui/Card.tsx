import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "default" | "none";
}

export function Card({
  className,
  padding = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white",
        padding === "default" && "p-4",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-base font-semibold text-gray-900", className)}
      {...props}
    />
  );
}
