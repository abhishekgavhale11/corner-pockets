"use client";

import { createContext, useContext } from "react";

/**
 * DOM node (rendered by DashboardShell, directly under the fixed header and
 * above the scrollable `main`) that the Counter workspace tabs portal into.
 * This guarantees the tabs sit flush against the header — zero padding/margin
 * math, zero gap — regardless of `main`'s own padding, which stays untouched
 * for every other screen.
 */
export const CounterShellSlotContext = createContext<HTMLDivElement | null>(
  null
);

export function useCounterShellSlot() {
  return useContext(CounterShellSlotContext);
}
