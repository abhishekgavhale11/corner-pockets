"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { settleNotebookEntries, reverseNotebookSettlement } from "@/actions/notebook-settlements";
import { getCustomerLedgerSummary } from "@/actions/customer-ledger";
import {
  finishVisit,
  getActiveVisitBillForCustomer,
  getActiveVisitCheckoutSettlements,
} from "@/actions/visit-bill";
import {
  getCustomerPendingItems,
  getSessionPendingItems,
  getTablePendingItems,
  assignCheckoutBillToCustomer,
  dismissCheckoutBill,
} from "@/actions/notebook-entries";
import {
  getSessionCheckoutDetails,
  assignTableSessionCustomers,
} from "@/actions/table-sessions";
import { checkoutEntryGroup } from "@/lib/constants/counter-sections";
import { groupCheckoutTabs } from "@/lib/utils/checkout-tabs";
import { formatCurrency } from "@/lib/utils/format";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { getCustomerBillSlice } from "@/lib/visit-bill/customer-bill-slice";
import {
  BillLineRow,
  CheckoutBillDetailsCard,
  CompactBillGroup,
} from "@/components/checkout/checkout-bill-lines";
import { formatCheckoutSessionTitle } from "@/lib/utils/session-display";
import type {
  ActiveVisitBillDTO,
  CustomerDTO,
  CustomerPendingItemDTO,
  NotebookEntryDTO,
  NotebookSettlementDTO,
  OpenTabSummaryDTO,
  SessionCheckoutDetailsDTO,
  SessionOpenTabSummaryDTO,
} from "@/types";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomerPickerDialog } from "@/components/customers/CustomerPickerDialog";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import { ContributorsSplitDialog } from "@/components/counter/ContributorsSplitDialog";
import { SessionCheckoutPanel } from "@/components/checkout/SessionCheckoutPanel";
import {
  CheckoutPaymentReview,
  parseCheckoutPayAmount,
  PaymentConfirmPanel,
} from "@/components/checkout/checkout-payment";
import type { VerificationMethod } from "@/lib/constants/verification";
import { cn } from "@/lib/utils/cn";
import { ConfirmDialog } from "@/components/ui/Dialog";

interface CheckoutListProps {
  tabs: OpenTabSummaryDTO[];
  initialQuery?: string;
  initialSessionId?: string;
  initialCustomerId?: string;
}

function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-8 w-8"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3h6m-7 4h8m-8 4h8m-8 4h5M7 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn(
        "h-5 w-5 shrink-0 transition-transform",
        expanded && "rotate-180"
      )}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BillItemRow({ item }: { item: CustomerPendingItemDTO }) {
  const customerId =
    item.contributorCustomerId || item.entry.customerId || "";
  const slice = getCustomerBillSlice(item.entry, customerId);
  const lineTotal =
    item.lineAmount ?? slice?.lineTotal ?? item.entry.amount;
  const paidOnLine =
    item.linePaidAmount ??
    slice?.paid ??
    (item.entry.checkoutDismissedAt
      ? (item.entry.counterPaidAmount ??
        Math.min(item.entry.paidAmount ?? 0, lineTotal))
      : Math.min(item.entry.paidAmount ?? 0, lineTotal));
  const dueOnLine = item.contributionAmount;
  const isPayLater =
    Boolean(item.entry.checkoutDismissedAt) && dueOnLine > 0;

  let note: string | undefined;
  if (isPayLater) {
    note =
      paidOnLine > 0
        ? `Pay later · ${formatCurrency(lineTotal)} total · ${formatCurrency(paidOnLine)} paid`
        : `Pay later · ${formatCurrency(lineTotal)} total`;
  } else if (paidOnLine > 0 && dueOnLine > 0) {
    note = `${formatCurrency(lineTotal)} total · ${formatCurrency(paidOnLine)} paid`;
  } else if (paidOnLine > 0 && dueOnLine <= 0) {
    note = `${formatCurrency(lineTotal)} paid`;
  }

  return (
    <li>
      <BillLineRow
        label={getEntryDisplayLabel(item.entry)}
        amount={dueOnLine > 0 ? dueOnLine : lineTotal}
        note={note}
      />
    </li>
  );
}

export function CheckoutList({
  tabs,
  initialQuery = "",
  initialSessionId,
  initialCustomerId,
}: CheckoutListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const appliedSessionDeepLinkRef = useRef<string | null>(null);
  const appliedCustomerDeepLinkRef = useRef<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [items, setItems] = useState<CustomerPendingItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablePayer, setTablePayer] = useState<CustomerDTO | null>(null);
  const [step, setStep] = useState<
    "review" | "confirm" | "wallet-verify" | "wallet-confirm"
  >("review");
  const [method, setMethod] = useState<NotebookPaymentMethod>("CASH");
  const [walletPayer, setWalletPayer] = useState<CustomerDTO | null>(null);
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sessionCheckout, setSessionCheckout] =
    useState<SessionCheckoutDetailsDTO | null>(null);
  const [splitEntry, setSplitEntry] = useState<NotebookEntryDTO | null>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showTableCustomer, setShowTableCustomer] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [ledgerOutstanding, setLedgerOutstanding] = useState<number | null>(null);
  const [visitBill, setVisitBill] = useState<ActiveVisitBillDTO | null>(null);
  const [checkoutSettlements, setCheckoutSettlements] = useState<
    NotebookSettlementDTO[]
  >([]);
  const [billDisplayItems, setBillDisplayItems] = useState<
    CustomerPendingItemDTO[]
  >([]);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const checkoutGroups = useMemo(() => groupCheckoutTabs(tabs), [tabs]);

  const activeTab = tabs.find((t) => t.tabKey === expandedKey) ?? null;
  const isTableTab = activeTab?.kind === "table";
  const isSessionTab = activeTab?.kind === "session";
  const needsCustomerPicker = isTableTab || isSessionTab;
  const checkoutCustomer =
    activeTab?.kind === "customer"
      ? {
          id: activeTab.customerId,
          name: activeTab.customerName,
          walletEnabled: activeTab.walletEnabled,
          cardId: activeTab.cardId,
        }
      : tablePayer
        ? {
            id: tablePayer.id,
            name: tablePayer.name,
            walletEnabled: tablePayer.walletEnabled,
            cardId: tablePayer.cardId,
          }
        : null;
  const totalPending = tabs.reduce((s, t) => s + t.pendingAmount, 0);

  const customerBillItems = useMemo(() => {
    if (activeTab?.kind !== "customer") {
      return items;
    }

    if (billDisplayItems.length > 0) {
      return billDisplayItems;
    }

    return items;
  }, [activeTab?.kind, billDisplayItems, items]);

  const customerDueItems = useMemo(
    () =>
      customerBillItems.filter((item) => item.contributionAmount > 0),
    [customerBillItems]
  );

  const customerPayableItems = customerDueItems;

  const grouped = useMemo(() => {
    const groups = {
      snooker: [] as CustomerPendingItemDTO[],
      poolMini: [] as CustomerPendingItemDTO[],
      cafe: [] as CustomerPendingItemDTO[],
    };
    const sourceItems =
      activeTab?.kind === "customer" ? customerBillItems : items;
    for (const item of sourceItems) {
      groups[checkoutEntryGroup(item.entry.section)].push(item);
    }
    return groups;
  }, [items, customerPayableItems, activeTab?.kind]);

  const customerCheckoutSummary = useMemo(() => {
    if (activeTab?.kind !== "customer" || !visitBill) return null;

    return {
      totalAmount: visitBill.bill.totalAmount,
      paidAmount: visitBill.bill.paidAmount,
      dueAmount: visitBill.bill.dueAmount,
    };
  }, [activeTab?.kind, visitBill]);

  const total = useMemo(() => {
    if (activeTab?.kind === "customer") {
      if (visitBill) {
        return visitBill.bill.dueAmount;
      }
      return customerDueItems.reduce(
        (sum, item) => sum + item.contributionAmount,
        0
      );
    }

    const fromItems = items.reduce(
      (sum, item) => sum + item.contributionAmount,
      0
    );
    if (fromItems > 0) return fromItems;
    if (
      activeTab &&
      (activeTab.kind === "session" || activeTab.kind === "table")
    ) {
      return activeTab.pendingAmount;
    }
    return fromItems;
  }, [items, activeTab, customerDueItems, visitBill]);

  const priorBalance = useMemo(() => {
    if (!ledgerOutstanding || ledgerOutstanding <= total) return 0;
    return ledgerOutstanding - total;
  }, [ledgerOutstanding, total]);

  const showPayLater = needsCustomerPicker && total > 0;
  const payLaterHint =
    showPayLater && !checkoutCustomer
      ? "Select a customer above, then tap Pay later."
      : null;
  const parsedPayAmount = parseCheckoutPayAmount(payAmount);

  const customerCheckoutMode = useMemo(() => {
    if (activeTab?.kind !== "customer") {
      return "new-bill" as const;
    }
    return "new-bill" as const;
  }, [activeTab?.kind]);

  useEffect(() => {
    if (total > 0) {
      setPayAmount(String(total));
    }
  }, [total, expandedKey]);

  useEffect(() => {
    if (!checkoutCustomer?.id) {
      setWalletBalance(null);
      setLedgerOutstanding(null);
      return;
    }
    void getCustomerLedgerSummary(checkoutCustomer.id).then((summary) => {
      setWalletBalance(summary?.walletBalance ?? null);
      setLedgerOutstanding(summary?.outstandingAmount ?? null);
    });
  }, [checkoutCustomer?.id]);

  useEffect(() => {
    if (method === "WALLET" && checkoutCustomer && !checkoutCustomer.walletEnabled) {
      setMethod("CASH");
    }
  }, [checkoutCustomer, method]);

  const deepLinkSessionId =
    searchParams.get("session") ?? initialSessionId ?? null;
  const deepLinkCustomerId =
    searchParams.get("customer") ?? initialCustomerId ?? null;

  const syncCheckoutUrl = useCallback(
    (tab: OpenTabSummaryDTO | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab?.kind === "session") {
        params.set("session", tab.sessionId);
        params.delete("customer");
      } else if (tab?.kind === "customer") {
        params.set("customer", tab.customerId);
        params.delete("session");
      } else {
        params.delete("session");
        params.delete("customer");
      }
      const qs = params.toString();
      router.replace(qs ? `/checkout?${qs}` : "/checkout", { scroll: false });
    },
    [router, searchParams]
  );

  const scrollToTab = useCallback((tabKey: string) => {
    cardRefs.current.get(tabKey)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  const focusPaymentActions = useCallback((tab: OpenTabSummaryDTO) => {
    requestAnimationFrame(() => {
      const card = cardRefs.current.get(tab.tabKey);
      if (!card) return;
      const needsPicker = tab.kind === "table" || tab.kind === "session";
      const selector = needsPicker
        ? '[data-checkout-action="select-customer"]'
        : '[data-checkout-action="pay"]';
      card.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    });
  }, []);

  const expandTab = useCallback(
    async (
      tab: OpenTabSummaryDTO,
      options?: { scroll?: boolean; focus?: boolean; syncUrl?: boolean }
    ) => {
      setLoading(true);
      setExpandedKey(tab.tabKey);
      setTablePayer(null);
      setStep("review");
      setError(null);
      setSessionCheckout(null);
      setPayAmount("");
      setWalletBalance(null);
      setLedgerOutstanding(null);
      setVisitBill(null);
      setCheckoutSettlements([]);
      setBillDisplayItems([]);
      if (options?.syncUrl !== false) {
        syncCheckoutUrl(tab);
      }
      const pending =
        tab.kind === "session"
          ? await getSessionPendingItems(tab.sessionId)
          : tab.kind === "table"
            ? await getTablePendingItems(tab.tableId)
            : await getCustomerPendingItems(tab.customerId);
      if (tab.kind === "customer") {
        const [activeVisitBill, visitItems, settlements] = await Promise.all([
          getActiveVisitBillForCustomer(tab.customerId),
          getCustomerPendingItems(tab.customerId),
          getActiveVisitCheckoutSettlements(tab.customerId),
        ]);
        setVisitBill(activeVisitBill);
        setBillDisplayItems(visitItems);
        setCheckoutSettlements(settlements);
      }
      if (tab.kind === "session") {
        const details = await getSessionCheckoutDetails(tab.sessionId);
        setSessionCheckout(details);
        if (details?.defaultPayer) {
          setTablePayer(details.defaultPayer);
        }
      }
      setItems(pending);
      setLoading(false);
      if (options?.scroll || options?.focus) {
        requestAnimationFrame(() => {
          if (options?.scroll) scrollToTab(tab.tabKey);
          if (options?.focus) {
            requestAnimationFrame(() => focusPaymentActions(tab));
          }
        });
      }
    },
    [focusPaymentActions, scrollToTab, syncCheckoutUrl]
  );

  const collapseTab = useCallback(() => {
    setExpandedKey(null);
    setItems([]);
    setTablePayer(null);
    setStep("review");
    setError(null);
    setSessionCheckout(null);
    setPayAmount("");
    setWalletBalance(null);
    setLedgerOutstanding(null);
    setVisitBill(null);
    setCheckoutSettlements([]);
    setBillDisplayItems([]);
    syncCheckoutUrl(null);
  }, [syncCheckoutUrl]);

  const reloadExpandedTab = useCallback(async () => {
    if (!activeTab) return;
    const pending =
      activeTab.kind === "session"
        ? await getSessionPendingItems(activeTab.sessionId)
        : activeTab.kind === "table"
          ? await getTablePendingItems(activeTab.tableId)
          : await getCustomerPendingItems(activeTab.customerId);
    if (activeTab.kind === "customer") {
      const [activeVisitBill, visitItems, settlements] = await Promise.all([
        getActiveVisitBillForCustomer(activeTab.customerId),
        getCustomerPendingItems(activeTab.customerId),
        getActiveVisitCheckoutSettlements(activeTab.customerId),
      ]);
      setVisitBill(activeVisitBill);
      setBillDisplayItems(visitItems);
      setCheckoutSettlements(settlements);
    }
    if (activeTab.kind === "session") {
      const details = await getSessionCheckoutDetails(activeTab.sessionId);
      setSessionCheckout(details);
      setTablePayer((current) => current ?? details?.defaultPayer ?? null);
    }
    setItems(pending);
  }, [activeTab]);

  useEffect(() => {
    appliedSessionDeepLinkRef.current = null;
  }, [deepLinkSessionId]);

  useEffect(() => {
    appliedCustomerDeepLinkRef.current = null;
  }, [deepLinkCustomerId]);

  useEffect(() => {
    if (!deepLinkSessionId || tabs.length === 0) return;
    if (appliedSessionDeepLinkRef.current === deepLinkSessionId) return;

    const tab = tabs.find(
      (row) => row.kind === "session" && row.sessionId === deepLinkSessionId
    );
    if (!tab) return;

    appliedSessionDeepLinkRef.current = deepLinkSessionId;
    void expandTab(tab, { scroll: true, focus: true, syncUrl: false });
  }, [deepLinkSessionId, expandTab, tabs]);

  useEffect(() => {
    if (!deepLinkCustomerId || tabs.length === 0) return;
    if (appliedCustomerDeepLinkRef.current === deepLinkCustomerId) return;

    const tab = tabs.find(
      (row) =>
        row.kind === "customer" && row.customerId === deepLinkCustomerId
    );
    if (!tab) return;

    appliedCustomerDeepLinkRef.current = deepLinkCustomerId;
    void expandTab(tab, { scroll: true, focus: true, syncUrl: false });
  }, [deepLinkCustomerId, expandTab, tabs]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    router.replace(params.toString() ? `/checkout?${params}` : "/checkout");
  };

  const toggleRow = async (tab: OpenTabSummaryDTO) => {
    if (expandedKey === tab.tabKey) {
      collapseTab();
      return;
    }
    await expandTab(tab);
  };

  const handleCheckoutCustomerSelect = (customer: CustomerDTO) => {
    setShowTableCustomer(false);
    setTablePayer(customer);
    setError(null);

    const tab = tabs.find((row) => row.tabKey === expandedKey);
    if (tab?.kind !== "session") return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", tab.sessionId);
      formData.set("customerIds", JSON.stringify([customer.id]));
      const result = await assignTableSessionCustomers(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to assign customer");
        return;
      }
      const details = await getSessionCheckoutDetails(tab.sessionId);
      setSessionCheckout(details);
      router.refresh();
    });
  };

  const processPayment = () => {
    if (!activeTab) return;
    if (needsCustomerPicker && !checkoutCustomer) return;
    if (activeTab.kind === "customer" && !checkoutCustomer) return;

    const amount = parsedPayAmount;
    if (amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amount > total) {
      setError("Amount cannot be more than total due");
      return;
    }
    if (amount < total && !checkoutCustomer) {
      setError("Select a customer to record a partial payment");
      return;
    }
    if (
      method === "WALLET" &&
      checkoutCustomer &&
      !checkoutCustomer.walletEnabled
    ) {
      setError("Wallet is not enabled for this customer");
      return;
    }

    startTransition(async () => {
      const payTotal = amount;
      let remaining = payTotal;
      const allocations: { entryId: string; amount: number }[] = [];
      const payableItems =
        activeTab.kind === "customer" ? customerPayableItems : items;
      for (const item of payableItems) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, item.contributionAmount);
        if (applied <= 0) continue;
        allocations.push({ entryId: item.entry.id, amount: applied });
        remaining -= applied;
      }

      if (allocations.length === 0) {
        setError("Nothing to pay on this bill");
        return;
      }

      const formData = new FormData();
      allocations.forEach((row) => formData.append("entryIds", row.entryId));
      formData.set("allocations", JSON.stringify(allocations));
      formData.set("paymentMethod", method);
      formData.set("paidByName", checkoutCustomer?.name ?? "");
      if (checkoutCustomer) {
        formData.set("paidByCustomerId", checkoutCustomer.id);
      }
      formData.set("idempotencyKey", crypto.randomUUID());
      if (method === "WALLET" && walletPayer && verificationMethod) {
        formData.set("paidByCustomerId", walletPayer.id);
        formData.set("verificationMethod", verificationMethod);
        formData.set("customerConfirmed", "true");
      }
      const result = await settleNotebookEntries(formData);
      if (result.success) {
        appliedSessionDeepLinkRef.current = null;
        appliedCustomerDeepLinkRef.current = null;
        setStep("review");
        setPayAmount(total > 0 ? String(Math.max(0, total - payTotal)) : "");
        setWalletPayer(null);
        setVerificationMethod(null);
        setError(null);
        await reloadExpandedTab();
        router.refresh();
      } else {
        setError(result.error ?? "Settlement failed");
      }
    });
  };

  const addToBalance = () => {
    if (!activeTab || !checkoutCustomer || total <= 0) {
      if (!checkoutCustomer) {
        setError("Select a customer first");
      }
      return;
    }

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("customerId", checkoutCustomer.id);
      if (items.length > 0) {
        formData.set(
          "entryIds",
          JSON.stringify(items.map((item) => item.entry.id))
        );
      }
      if (activeTab.kind === "session") {
        formData.set("sessionId", activeTab.sessionId);
      } else if (activeTab.kind === "table") {
        formData.set("tableId", activeTab.tableId);
      }
      const result = await assignCheckoutBillToCustomer(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to add to balance");
        return;
      }
      setError(null);
      appliedSessionDeepLinkRef.current = null;
      appliedCustomerDeepLinkRef.current = null;
      collapseTab();
      router.replace("/checkout", { scroll: false });
      await router.refresh();
    });
  };

  const dismissCustomerCheckout = () => {
    if (!activeTab || activeTab.kind !== "customer") return;

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("customerId", activeTab.customerId);
      if (items.length > 0) {
        formData.set(
          "entryIds",
          JSON.stringify(items.map((item) => item.entry.id))
        );
      }
      const result = await dismissCheckoutBill(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to record balance");
        return;
      }
      appliedSessionDeepLinkRef.current = null;
      appliedCustomerDeepLinkRef.current = null;
      collapseTab();
      router.replace("/checkout", { scroll: false });
      await router.refresh();
    });
  };

  const finishCustomerVisit = () => {
    if (!activeTab || activeTab.kind !== "customer" || !visitBill) return;

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("customerId", activeTab.customerId);
      const result = await finishVisit(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to finish visit");
        return;
      }
      setError(null);
      setFinishConfirmOpen(false);
      appliedSessionDeepLinkRef.current = null;
      appliedCustomerDeepLinkRef.current = null;
      collapseTab();
      router.replace("/checkout", { scroll: false });
      await router.refresh();
    });
  };

  const requestFinishCustomerVisit = () => {
    if (!activeTab || activeTab.kind !== "customer" || !visitBill) return;
    setFinishConfirmOpen(true);
  };

  const finishDueAmount =
    customerCheckoutSummary?.dueAmount ?? visitBill?.bill.dueAmount ?? 0;
  const finishConfirmMessage =
    finishDueAmount > 0
      ? `${formatCurrency(finishDueAmount)} will be moved to Outstanding. This visit will become permanently read-only and cannot be reopened in Checkout.`
      : "This visit will be completed and locked. All counter entries will become read-only.";

  const removeCheckoutPayment = (settlementId: string) => {
    if (!activeTab || activeTab.kind !== "customer") return;

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("settlementId", settlementId);
      formData.set("reversalReason", "DUPLICATE");
      const result = await reverseNotebookSettlement(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to remove payment");
        return;
      }
      setError(null);
      await reloadExpandedTab();
      router.refresh();
    });
  };

  const beginPayment = () => {
    const amount = parsedPayAmount;
    if (amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amount > total) {
      setError("Amount cannot be more than total due");
      return;
    }
    if (amount < total && !checkoutCustomer) {
      setError("Select a customer to record a partial payment");
      return;
    }
    setError(null);
    if (
      method === "WALLET" &&
      checkoutCustomer &&
      !checkoutCustomer.walletEnabled
    ) {
      setError("Wallet is not enabled for this customer");
      return;
    }
    if (method === "WALLET") {
      setStep("wallet-verify");
    } else {
      setStep("confirm");
    }
  };

  const renderBillDetails = () => {
    const hasLines =
      grouped.snooker.length > 0 ||
      grouped.poolMini.length > 0 ||
      grouped.cafe.length > 0;
    if (!hasLines) return null;

    return (
      <CheckoutBillDetailsCard>
        {renderGroup("Snooker", grouped.snooker)}
        {renderGroup("Pool / Mini", grouped.poolMini)}
        {renderGroup("Cafe", grouped.cafe)}
      </CheckoutBillDetailsCard>
    );
  };

  const renderGroup = (
    title: string,
    groupItems: CustomerPendingItemDTO[]
  ) =>
    groupItems.length > 0 ? (
      <CompactBillGroup title={title}>
        {groupItems.map((item) => (
          <BillItemRow
            key={`${item.entry.id}-${item.contributionAmount}`}
            item={item}
          />
        ))}
      </CompactBillGroup>
    ) : null;

  const openSessionSplitBill = () => {
    const gameItem = items.find(
      (item) => checkoutEntryGroup(item.entry.section) === "poolMini"
    );
    setSplitEntry(gameItem?.entry ?? items[0]?.entry ?? null);
  };

  const getTabTitle = (tab: OpenTabSummaryDTO) => {
    if (tab.kind === "session") {
      return formatCheckoutSessionTitle(tab.tableId, tab.tableSessionNumber);
    }
    if (tab.kind === "table") return tab.tableName;
    return tab.customerName;
  };

  const getTabSubtitle = (tab: OpenTabSummaryDTO) => {
    if (tab.kind === "session") {
      return {
        primary: "",
        secondary: "",
      };
    }
    if (tab.kind === "table") {
      return {
        primary: `${tab.pendingCount} item${tab.pendingCount === 1 ? "" : "s"}`,
        secondary: "Unassigned table",
      };
    }
    return {
      primary: `${tab.pendingCount} item${tab.pendingCount === 1 ? "" : "s"}`,
      secondary: tab.cardId,
    };
  };

  const renderTabCard = (tab: OpenTabSummaryDTO) => {
    const expanded = expandedKey === tab.tabKey;
    const isActiveTab = activeTab?.tabKey === tab.tabKey;
    const headerAmount =
      expanded && isActiveTab && !loading ? total : tab.pendingAmount;
    const title = getTabTitle(tab);
    const subtitle = getTabSubtitle(tab);

    return (
      <li
        key={tab.tabKey}
        ref={(el) => {
          if (el) cardRefs.current.set(tab.tabKey, el);
          else cardRefs.current.delete(tab.tabKey);
        }}
        data-checkout-tab={tab.tabKey}
      >
        <Card
          padding="none"
          className={cn(
            "overflow-hidden rounded-xl border shadow-sm transition-shadow",
            expanded
              ? "border-emerald-700/30 ring-1 ring-emerald-800/10"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Hide bill for ${title}`
                : `View bill for ${title}`
            }
            onClick={() => void toggleRow(tab)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
              expanded ? "bg-emerald-50/60" : "bg-white hover:bg-gray-50"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {tab.kind === "customer" ? (
                    <Link
                      href={`/customers/${tab.customerId}`}
                      className="block text-sm font-bold text-gray-900 hover:text-gray-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {title}
                    </Link>
                  ) : (
                    <p className="text-sm font-bold text-gray-900">{title}</p>
                  )}
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums text-gray-900">
                  {formatCurrency(headerAmount)}
                </p>
              </div>
              {(subtitle.primary || subtitle.secondary) && (
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {subtitle.primary ? (
                    <p className="text-xs font-medium text-gray-500">
                      {subtitle.primary}
                    </p>
                  ) : null}
                  {subtitle.secondary ? (
                    <p className="text-xs font-medium text-gray-500">
                      {subtitle.secondary}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
                expanded ? "text-gray-600" : "text-emerald-800"
              )}
            >
              {expanded ? "Close" : "Open"}
              <ChevronIcon expanded={expanded} />
            </span>
          </button>

          {expanded ? (
            <div className="space-y-3 border-t border-gray-200 bg-white px-3 py-3">
              {loading ? (
                <p className="py-4 text-center text-sm font-medium text-gray-500">
                  Loading bill…
                </p>
              ) : (
                <>
                  {tab.kind === "session" && sessionCheckout ? (
                    <SessionCheckoutPanel
                      tab={tab as SessionOpenTabSummaryDTO}
                      details={sessionCheckout}
                      total={total}
                      priorBalance={priorBalance}
                      payAmount={payAmount}
                      onPayAmountChange={setPayAmount}
                      walletBalance={walletBalance}
                      checkoutCustomer={checkoutCustomer}
                      step={step}
                      method={method}
                      walletPayer={walletPayer}
                      verificationMethod={verificationMethod}
                      error={error}
                      isPending={isPending}
                      onSelectCustomer={() => setShowTableCustomer(true)}
                      onSplitBill={openSessionSplitBill}
                      onMethodChange={setMethod}
                      onPayClick={beginPayment}
                      onWalletVerified={(customer, vMethod) => {
                        setWalletPayer(customer);
                        setVerificationMethod(vMethod);
                        setStep("wallet-confirm");
                      }}
                      onWalletConfirm={() => setStep("confirm")}
                      onWalletBack={() => setStep("wallet-verify")}
                      onConfirmPayment={processPayment}
                      onBackToReview={() => setStep("review")}
                      onAddToBalance={showPayLater ? addToBalance : undefined}
                      addToBalanceDisabled={isPending || !checkoutCustomer}
                      addToBalanceHint={payLaterHint}
                    />
                  ) : tab.kind === "session" ? (
                    <EmptyState
                      compact
                      icon={<ReceiptIcon />}
                      title="Unable to load session bill"
                    />
                  ) : (
                    <>
                      {step === "review" ? (
                        <div className="space-y-3">
                          {needsCustomerPicker ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  {isSessionTab
                                    ? "Session customer"
                                    : "Table customer"}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                                  {checkoutCustomer?.name ??
                                    "Select who is paying"}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                data-checkout-action="select-customer"
                                onClick={() => setShowTableCustomer(true)}
                              >
                                {checkoutCustomer
                                  ? "Change"
                                  : "Select customer"}
                              </Button>
                            </div>
                          ) : null}

                          <CheckoutPaymentReview
                            total={total}
                            priorBalance={priorBalance}
                            payAmount={payAmount}
                            onPayAmountChange={setPayAmount}
                            method={method}
                            onMethodChange={setMethod}
                            walletBalance={walletBalance}
                            walletEnabled={checkoutCustomer?.walletEnabled}
                            onPayClick={beginPayment}
                            payDisabled={
                              (needsCustomerPicker && !checkoutCustomer) ||
                              parsedPayAmount <= 0
                            }
                            onAddToBalance={
                              showPayLater ? addToBalance : undefined
                            }
                            addToBalanceDisabled={isPending || !checkoutCustomer}
                            addToBalanceHint={payLaterHint}
                            checkoutMode={customerCheckoutMode}
                            visitBillTotal={
                              customerCheckoutSummary?.totalAmount ??
                              visitBill?.bill.totalAmount
                            }
                            visitBillPaid={
                              customerCheckoutSummary?.paidAmount ??
                              visitBill?.bill.paidAmount
                            }
                            visitBillDue={
                              customerCheckoutSummary?.dueAmount ??
                              visitBill?.bill.dueAmount
                            }
                            billDetails={renderBillDetails()}
                            onCloseBill={
                              tab.kind === "customer" && total > 0
                                ? dismissCustomerCheckout
                                : undefined
                            }
                            onFinishVisit={
                              tab.kind === "customer" && visitBill
                                ? requestFinishCustomerVisit
                                : undefined
                            }
                            finishVisitDisabled={isPending}
                            checkoutSettlements={checkoutSettlements}
                            onRemovePayment={removeCheckoutPayment}
                            error={error}
                            isPending={isPending}
                          />
                        </div>
                      ) : null}

                      {step === "wallet-verify" && checkoutCustomer ? (
                        <CustomerVerification
                          initialCardId={
                            checkoutCustomer.walletEnabled
                              ? checkoutCustomer.cardId
                              : undefined
                          }
                          onVerified={(customer, vMethod) => {
                            setWalletPayer(customer);
                            setVerificationMethod(vMethod);
                            setStep("wallet-confirm");
                          }}
                        />
                      ) : null}

                      {step === "wallet-confirm" &&
                      walletPayer &&
                      verificationMethod ? (
                        <WalletCustomerConfirmation
                          customer={walletPayer}
                          verificationMethod={verificationMethod}
                          onConfirm={() => setStep("confirm")}
                          onBack={() => setStep("wallet-verify")}
                        />
                      ) : null}

                      {step === "confirm" ? (
                        <PaymentConfirmPanel
                          customerName={checkoutCustomer?.name ?? title}
                          method={method}
                          totalDue={total}
                          payAmount={
                            parsedPayAmount > 0 ? parsedPayAmount : total
                          }
                          error={error}
                          isPending={isPending}
                          onConfirm={processPayment}
                          onBack={() => setStep("review")}
                        />
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>
          ) : null}
        </Card>
      </li>
    );
  };

  const renderCheckoutSection = (
    title: string,
    summary: { billCount: number; subtotal: number },
    sectionTabs: OpenTabSummaryDTO[]
  ) => (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <p className="text-xs font-semibold tabular-nums text-gray-500">
          {summary.billCount} open · {formatCurrency(summary.subtotal)}
        </p>
      </div>
      {sectionTabs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-500">No open bills</p>
        </div>
      ) : (
        <ul className="space-y-3">{sectionTabs.map(renderTabCard)}</ul>
      )}
    </section>
  );

  const poolSection = {
    title: "Pool & Mini",
    summary: checkoutGroups.summaries.poolMini,
    tabs: checkoutGroups.poolMini,
  };
  const customerSection = {
    title: "Customers",
    summary: checkoutGroups.summaries.customers,
    tabs: checkoutGroups.customers,
  };
  const checkoutSections = [poolSection, customerSection];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-950">
            Checkout
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tabs.length} open bill{tabs.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-gray-950">
          {formatCurrency(totalPending)}
        </p>
      </header>

      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="min-w-0 flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, or card ID"
            className="min-h-[40px] text-sm"
          />
        </form>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => setShowQuickCustomer(true)}
        >
          Quick customer
        </Button>
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        {checkoutSections.map((section) =>
          renderCheckoutSection(
            section.title,
            section.summary,
            section.tabs
          )
        )}
      </div>

      <ContributorsSplitDialog
        entry={splitEntry}
        onClose={() => {
          setSplitEntry(null);
          void reloadExpandedTab();
        }}
      />

      <CustomerPickerDialog
        open={showTableCustomer}
        onClose={() => setShowTableCustomer(false)}
        onSelect={handleCheckoutCustomerSelect}
        title={
          isSessionTab ? "Assign to session" : "Customer for table bill"
        }
        selectLabel={isSessionTab ? "Assign" : "Select"}
      />

      <CustomerPickerDialog
        open={showQuickCustomer}
        onClose={() => setShowQuickCustomer(false)}
        onSelect={(customer) => {
          setShowQuickCustomer(false);
          router.push(`/customers/${customer.id}`);
        }}
        title="Quick customer"
        selectLabel="Create"
      />

      <ConfirmDialog
        open={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        onConfirm={finishCustomerVisit}
        title="Finish visit?"
        message={finishConfirmMessage}
        confirmLabel="Finish Visit"
        isLoading={isPending}
      />
    </div>
  );
}
