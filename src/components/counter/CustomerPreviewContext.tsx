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
import { getCustomerVisitGlance } from "@/actions/visit-bill";
import { CustomerVisitGlancePanel } from "@/components/counter/CafeCustomerGlanceHover";
import { cn } from "@/lib/utils/cn";

const MODAL_WIDTH_PX = 420;
const MODAL_ANIMATION_MS = 175;
const SINGLE_CLICK_DELAY_MS = 220;

/** Bumped when counter/cafe data changes so open previews refetch. */
let glanceEpoch = 0;
const glanceEpochListeners = new Set<() => void>();

function subscribeGlanceEpoch(listener: () => void) {
  glanceEpochListeners.add(listener);
  return () => {
    glanceEpochListeners.delete(listener);
  };
}

function bumpGlanceEpoch() {
  glanceEpoch += 1;
  glanceEpochListeners.forEach((listener) => listener());
}

export function invalidateCustomerGlanceCache(_customerId?: string) {
  bumpGlanceEpoch();
}

interface CustomerPreviewContextValue {
  selectedCustomerId: string | null;
  isSelected: (customerId: string) => boolean;
  selectCustomer: (customerId: string) => void;
  clearSelection: () => void;
}

const CustomerPreviewContext = createContext<CustomerPreviewContextValue | null>(
  null
);

function useCustomerVisitGlance(
  customerId: string | null,
  enabled: boolean,
  fetchGeneration: number
) {
  const [glance, setGlance] = useState<Awaited<
    ReturnType<typeof getCustomerVisitGlance>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [epoch, setEpoch] = useState(glanceEpoch);
  const requestIdRef = useRef(0);

  useEffect(() => subscribeGlanceEpoch(() => setEpoch(glanceEpoch)), []);

  useEffect(() => {
    if (!enabled || !customerId) {
      setGlance(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setGlance(null);

    void getCustomerVisitGlance(customerId).then((data) => {
      if (requestId !== requestIdRef.current) return;
      setGlance(data);
      setLoading(false);
    });
  }, [customerId, enabled, fetchGeneration, epoch]);

  return { glance, loading };
}

function CustomerPreviewModal({
  customerId,
  visible,
  onClose,
}: {
  customerId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const { glance, loading } = useCustomerVisitGlance(
    customerId,
    true,
    fetchGeneration
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFetchGeneration((generation) => generation + 1);
  }, [customerId]);

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
  }, [customerId]);

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
        aria-label="Close preview"
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
        aria-label="Customer preview"
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
          aria-label="Close preview"
          className="absolute right-2 top-2 rounded p-0.5 text-[15px] leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>

        {loading ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">Loading visit…</p>
          </div>
        ) : glance ? (
          <CustomerVisitGlancePanel glance={glance} onClose={onClose} />
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">Could not load visit.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function CustomerPreviewProvider({ children }: { children: ReactNode }) {
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const selectCustomer = useCallback(
    (customerId: string) => {
      clearCloseTimer();
      setOpenCustomerId(customerId);
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
        <CustomerPreviewModal
          customerId={openCustomerId}
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
      preview.selectCustomer(customerId);
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
        `${customerName} — click to preview, double-click for profile`
      }
    >
      {customerName}
    </button>
  );
}

export function useCustomerRowPreviewHandlers(
  customerId: string | null | undefined
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
        preview.selectCustomer(customerId);
      }, SINGLE_CLICK_DELAY_MS);
    },
    [clearClickTimer, customerId, preview]
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
