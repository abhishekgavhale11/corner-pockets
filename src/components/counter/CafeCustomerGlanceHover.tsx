"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { getCustomerTodayGlance } from "@/actions/notebook-entries";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import {
  cafeGlanceCountForType,
  formatCafeLineExpanded,
  formatFrameGlanceLine,
} from "@/lib/utils/customer-today-glance";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerTodayGlanceDTO } from "@/types";
import { cn } from "@/lib/utils/cn";

/** Bumped when counter/cafe data changes so open hovers refetch. */
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

interface CafeCustomerGlancePanelProps {
  glance: CustomerTodayGlanceDTO;
  highlightType?: NotebookEntryType;
  itemLabel?: string;
}

export function CafeCustomerGlancePanel({
  glance,
  highlightType,
  itemLabel,
}: CafeCustomerGlancePanelProps) {
  const highlightCount = highlightType
    ? cafeGlanceCountForType(glance, highlightType)
    : 0;
  const isEmpty = glance.frameCount === 0 && glance.cafe.length === 0;

  return (
    <div className="text-left">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
        Today so far
      </p>

      {highlightType && itemLabel && (
        <p
          className={cn(
            "mt-1 text-[12px] font-semibold",
            highlightCount > 0 ? "text-amber-800" : "text-gray-500"
          )}
        >
          {highlightCount > 0
            ? `${itemLabel} already today: ${highlightCount}`
            : `No ${itemLabel.toLowerCase()} yet today`}
        </p>
      )}

      {isEmpty ? (
        <p className="mt-2 text-[12px] text-gray-500">Nothing recorded yet.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {glance.frames.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-700">
                Frames ({glance.frameCount}) ·{" "}
                {formatCurrency(glance.frameTotal)}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {glance.frames.map((line) => (
                  <li
                    key={line.label}
                    className="flex justify-between gap-2 text-[11px] text-gray-700"
                  >
                    <span className="truncate">{formatFrameGlanceLine(line)}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {glance.cafe.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-700">
                Cafe · {formatCurrency(glance.cafeTotal)}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {glance.cafe.map((line) => (
                  <li
                    key={line.lineKey}
                    className={cn(
                      "flex justify-between gap-2 text-[11px]",
                      highlightType === line.type
                        ? "font-bold text-amber-900"
                        : "text-gray-700"
                    )}
                  >
                    <span className="truncate">
                      {formatCafeLineExpanded(line)}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
            <span className="text-[12px] font-bold text-gray-900">Total</span>
            <span className="text-[13px] font-bold tabular-nums text-emerald-800">
              {formatCurrency(glance.grandTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function useCustomerGlance(
  customerId: string | null,
  enabled: boolean,
  fetchGeneration: number
) {
  const [glance, setGlance] = useState<CustomerTodayGlanceDTO | null>(null);
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

    void getCustomerTodayGlance(customerId).then((data) => {
      if (requestId !== requestIdRef.current) return;
      setGlance(data);
      setLoading(false);
    });
  }, [customerId, enabled, fetchGeneration, epoch]);

  return { glance, loading };
}

const FLOATING_PANEL_WIDTH = 288;

function useFloatingCoords(
  anchorRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  useEffect(() => {
    if (!enabled || !anchorRef.current) {
      setCoords(null);
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    let left = rect.right - FLOATING_PANEL_WIDTH;
    left = Math.max(
      8,
      Math.min(left, window.innerWidth - FLOATING_PANEL_WIDTH - 8)
    );

    let top = rect.bottom + 6;
    const estimatedHeight = 220;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }

    setCoords({ top, left });
  }, [anchorRef, enabled]);

  return coords;
}

interface CustomerGlanceHoverTargetProps {
  customerId: string;
  children: ReactNode;
  className?: string;
  /**
   * `inline` — expands below (customer search list).
   * `popover` — absolute popover beside anchor.
   * `floating` — fixed portal (table rows inside scroll areas).
   */
  variant?: "inline" | "popover" | "floating";
  popoverClassName?: string;
}

export function CustomerGlanceHoverTarget({
  customerId,
  children,
  className,
  variant = "inline",
  popoverClassName,
}: CustomerGlanceHoverTargetProps) {
  const [hovering, setHovering] = useState(false);
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const { glance, loading } = useCustomerGlance(
    customerId,
    hovering,
    fetchGeneration
  );
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const coords = useFloatingCoords(anchorRef, hovering && variant === "floating");

  const panel = loading ? (
    <p className="text-[11px] text-gray-500">Loading today&apos;s tab…</p>
  ) : glance ? (
    <CafeCustomerGlancePanel glance={glance} />
  ) : null;

  const show = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setFetchGeneration((generation) => generation + 1);
    setHovering(true);
  };

  const scheduleHide = () => {
    hideTimerRef.current = window.setTimeout(() => setHovering(false), 80);
  };

  const panelClassName =
    "rounded-lg border border-gray-200 bg-white p-3 shadow-lg";

  const floatingPanel =
    hovering &&
    panel &&
    variant === "floating" &&
    coords &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: FLOATING_PANEL_WIDTH,
            }}
            className={cn("z-[200]", panelClassName)}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            {panel}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={cn(
          "inline-block max-w-full",
          variant === "inline" &&
            hovering &&
            "rounded-lg border border-emerald-300 bg-emerald-50/30",
          variant === "popover" && "relative",
          className
        )}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
      >
        {children}
        {hovering &&
          panel &&
          variant === "inline" && (
            <div className="border-t border-emerald-200 px-4 py-2 text-left">
              {panel}
            </div>
          )}
        {hovering &&
          panel &&
          variant === "popover" && (
            <div
              role="tooltip"
              className={cn(
                "absolute left-0 top-full z-50 mt-1 w-full min-w-[14rem]",
                panelClassName,
                "sm:w-72",
                popoverClassName
              )}
            >
              {panel}
            </div>
          )}
      </span>
      {floatingPanel}
    </>
  );
}

export function invalidateCustomerGlanceCache(_customerId?: string) {
  bumpGlanceEpoch();
}
