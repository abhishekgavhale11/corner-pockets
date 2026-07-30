"use client";

interface NewCustomerButtonProps {
  onClick: () => void;
}

/**
 * Shared "+ New Customer" trigger for the counter workspace toolbar.
 * Keeps the same look wherever it appears (Big Snooker, Pool & Mini, Cafe).
 */
export function NewCustomerButton({ onClick }: NewCustomerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[52px] shrink-0 items-center gap-1.5 rounded-[14px] border border-emerald-200 bg-white px-5 text-[14px] font-semibold text-emerald-900 shadow-sm shadow-emerald-900/5 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
    >
      <span className="text-[16px] font-bold leading-none" aria-hidden>
        +
      </span>
      New Customer
    </button>
  );
}
