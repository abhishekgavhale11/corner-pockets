"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getCustomerCounterDrawerAction } from "@/actions/customer-drawer";
import { CustomerCounterDrawerPanel } from "@/components/counter/CustomerCounterDrawerPanel";
import { cn } from "@/lib/utils/cn";
import type { CustomerCounterDrawerDTO } from "@/types";

const MODAL_WIDTH_PX = 420;
const MODAL_ANIMATION_MS = 175;
const SINGLE_CLICK_DELAY_MS = 220;

/** Bumped when counter data changes so open drawers refetch. */
let drawerEpoch = 0;
const drawerEpochListeners = new Set<() => void>();

function subscribeDrawerEpoch(listener: () => void) {
  drawerEpochListeners.add(listener);
  return () => {
    drawerEpochListeners.delete(listener);
  };
}

function bumpDrawerEpoch() {
  drawerEpoch += 1;
  drawerEpochListeners.forEach((listener) => listener());
}

export function invalidateCustomerGlanceCache(_customerId?: string) {
  bumpDrawerEpoch();
}

interface CustomerPreviewContextValue {
  selectedCustomerId: string | null;
  isSelected: (customerId: string) => boolean;
  selectCustomer: (customerId: string, customerName?: string) => void;
  clearSelection: () => void;
}

const CustomerPreviewContext = createContext<CustomerPreviewContextValue | null>(
  null
);

function emptyDrawer(
  customerId: string,
  customerName?: string
): CustomerCounterDrawerDTO {
  return {
    customerId,
    customerName: customerName || "Customer",
    todaysBill: 0,
    totalReceived: 0,
    totalDue: 0,
    todaysFrames: [],
    todaysCafeOrders: [],
  };
}

function CustomerDrawerModal({
  customerId,
  customerName,
  visible,
  onClose,
}: {
  customerId: string;
  customerName?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [epoch, setEpoch] = useState(drawerEpoch);
  const [summary, setSummary] = useState<CustomerCounterDrawerDTO>(() =>
    emptyDrawer(customerId, customerName)
  );
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeDrawerEpoch(() => setEpoch(drawerEpoch)), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getCustomerCounterDrawerAction(customerId).then((data) => {
      if (cancelled) return;
      setSummary(data ?? emptyDrawer(customerId, customerName));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, customerName, epoch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [customerId, epoch]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close customer drawer"
        tabIndex={-1}
        className={cn(
          "absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: `${MODAL_ANIMATION_MS}ms` }}
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Customer summary"
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[min(90vh,720px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl transition-all ease-out",
          visible ? "scale-100 opacity-100" : "scale-[0.96] opacity-0"
        )}
        style={{
          width: MODAL_WIDTH_PX,
          maxWidth: "100%",
          transitionDuration: `${MODAL_ANIMATION_MS}ms`,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 rounded p-0.5 text-[15px] leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : (
          <CustomerCounterDrawerPanel
            summary={summary}
            onPaymentComplete={() => {
              invalidateCustomerGlanceCache(customerId);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

export function CustomerPreviewProvider({ children }: { children: ReactNode }) {
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [openCustomerName, setOpenCustomerName] = useState<string | undefined>();
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const selectCustomer = useCallback(
    (customerId: string, customerName?: string) => {
      clearCloseTimer();
      setOpenCustomerId(customerId);
      setOpenCustomerName(customerName);
      requestAnimationFrame(() => setVisible(true));
    },
    [clearCloseTimer]
  );

  const clearSelection = useCallback(() => {
    setVisible(false);
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpenCustomerId(null);
      setOpenCustomerName(undefined);
    }, MODAL_ANIMATION_MS);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const isSelected = useCallback(
    (customerId: string) => openCustomerId === customerId && visible,
    [openCustomerId, visible]
  );

  return (
    <CustomerPreviewContext.Provider
      value={{
        selectedCustomerId: openCustomerId,
        isSelected,
        selectCustomer,
        clearSelection,
      }}
    >
      {children}
      {openCustomerId ? (
        <CustomerDrawerModal
          customerId={openCustomerId}
          customerName={openCustomerName}
          visible={visible}
          onClose={clearSelection}
        />
      ) : null}
    </CustomerPreviewContext.Provider>
  );
}

export function useCustomerPreview() {
  const context = useContext(CustomerPreviewContext);
  if (!context) {
    throw new Error(
      "useCustomerPreview must be used within CustomerPreviewProvider"
    );
  }
  return context;
}

export function useCustomerPreviewOptional() {
  return useContext(CustomerPreviewContext);
}

export function customerPreviewRowClass(selected: boolean): string {
  return selected
    ? "bg-emerald-50/90 ring-1 ring-inset ring-emerald-300"
    : "";
}

interface CustomerPreviewNameButtonProps {
  customerId: string;
  customerName: string;
  className?: string;
  title?: string;
}

export function CustomerPreviewNameButton({
  customerId,
  customerName,
  className,
  title,
}: CustomerPreviewNameButtonProps) {
  const router = useRouter();
  const preview = useCustomerPreview();
  const clickTimerRef = useRef<number | null>(null);
  const selected = preview.isSelected(customerId);

  const clearClickTimer = () => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  useEffect(() => clearClickTimer, []);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    clearClickTimer();
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      preview.selectCustomer(customerId, customerName);
    }, SINGLE_CLICK_DELAY_MS);
  };

  const handleDoubleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    clearClickTimer();
    router.push(`/customers/${customerId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "block min-w-0 truncate text-left text-[14px] font-bold leading-snug text-gray-900 hover:text-emerald-800",
        selected && "text-emerald-900",
        className
      )}
      title={
        title ??
        `${customerName} — click for today's summary, double-click for customer page`
      }
    >
      {customerName}
    </button>
  );
}

export function useCustomerRowPreviewHandlers(
  customerId: string | null | undefined,
  customerName?: string
) {
  const preview = useCustomerPreviewOptional();
  const router = useRouter();
  const clickTimerRef = useRef<number | null>(null);

  const clearClickTimer = useCallback(() => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearClickTimer, [clearClickTimer]);

  const handleRowClick = useCallback(
    (event: MouseEvent<HTMLTableRowElement>) => {
      if (!customerId || !preview) return;
      if ((event.target as HTMLElement).closest("button, a")) return;

      clearClickTimer();
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        preview.selectCustomer(customerId, customerName);
      }, SINGLE_CLICK_DELAY_MS);
    },
    [clearClickTimer, customerId, customerName, preview]
  );

  const handleRowDoubleClick = useCallback(
    (event: MouseEvent<HTMLTableRowElement>) => {
      if (!customerId) return;
      if ((event.target as HTMLElement).closest("button, a")) return;

      event.preventDefault();
      clearClickTimer();
      router.push(`/customers/${customerId}`);
    },
    [clearClickTimer, customerId, router]
  );

  return {
    isSelected: customerId ? (preview?.isSelected(customerId) ?? false) : false,
    handleRowClick,
    handleRowDoubleClick,
  };
}
