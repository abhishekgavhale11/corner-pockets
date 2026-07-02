import { ENTRY_LOCKED_TOOLTIP } from "@/lib/visit-bill/entry-edit-lock-constants";
import { cn } from "@/lib/utils/cn";

interface EntryLockIndicatorProps {
  className?: string;
  title?: string;
}

export function EntryLockIndicator({
  className,
  title = ENTRY_LOCKED_TOOLTIP,
}: EntryLockIndicatorProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-flex items-center justify-center text-gray-400", className)}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    </span>
  );
}
