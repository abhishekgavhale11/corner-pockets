"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { settleNotebookEntries } from "@/actions/notebook-settlements";
import { getCustomerPendingItems, getSessionPendingItems, getTablePendingItems } from "@/actions/notebook-entries";
import { getSessionCheckoutDetails, assignTableSessionCustomers } from "@/actions/table-sessions";
import { checkoutEntryGroup } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { groupCheckoutTabs } from "@/lib/utils/checkout-tabs";
import { formatCurrency } from "@/lib/utils/format";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { formatCheckoutSessionTitle } from "@/lib/utils/session-display";
import { formatClockTime } from "@/lib/utils/session-timer";
import type {
  CustomerDTO,
  CustomerPendingItemDTO,
  NotebookEntryDTO,
  OpenTabSummaryDTO,
  SessionCheckoutDetailsDTO,
  SessionOpenTabSummaryDTO,
} from "@/types";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CustomerPickerDialog } from "@/components/customers/CustomerPickerDialog";
import { CustomerVerification } from "@/components/wallet/CustomerVerification";
import { WalletCustomerConfirmation } from "@/components/wallet/WalletCustomerConfirmation";
import { ContributorsSplitDialog } from "@/components/counter/ContributorsSplitDialog";
import { SessionCheckoutPanel } from "@/components/checkout/SessionCheckoutPanel";
import type { VerificationMethod } from "@/lib/constants/verification";
import { cn } from "@/lib/utils/cn";

interface CheckoutListProps {
  tabs: OpenTabSummaryDTO[];
  initialQuery?: string;
  initialSessionId?: string;
}

const PAYMENT_METHODS: { id: NotebookPaymentMethod; label: string }[] = [
  { id: "CASH", label: "Cash" },
  { id: "GPAY", label: "GPay" },
  { id: "WALLET", label: "Wallet" },
];

export function CheckoutList({
  tabs,
  initialQuery = "",
  initialSessionId,
}: CheckoutListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const appliedDeepLinkRef = useRef<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [items, setItems] = useState<CustomerPendingItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablePayer, setTablePayer] = useState<CustomerDTO | null>(null);
  const [step, setStep] = useState<"review" | "confirm" | "wallet-verify" | "wallet-confirm">(
    "review"
  );
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

  const grouped = useMemo(() => {
    const groups = {
      snooker: [] as CustomerPendingItemDTO[],
      poolMini: [] as CustomerPendingItemDTO[],
      cafe: [] as CustomerPendingItemDTO[],
    };
    for (const item of items) {
      groups[checkoutEntryGroup(item.entry.section)].push(item);
    }
    return groups;
  }, [items]);

  const total = items.reduce((s, item) => s + item.contributionAmount, 0);

  const deepLinkSessionId =
    searchParams.get("session") ?? initialSessionId ?? null;

  const syncCheckoutUrl = useCallback(
    (tab: OpenTabSummaryDTO | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab?.kind === "session") {
        params.set("session", tab.sessionId);
      } else {
        params.delete("session");
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
      if (options?.syncUrl !== false) {
        syncCheckoutUrl(tab);
      }
      const pending =
        tab.kind === "session"
          ? await getSessionPendingItems(tab.sessionId)
          : tab.kind === "table"
            ? await getTablePendingItems(tab.tableId)
            : await getCustomerPendingItems(tab.customerId);
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
    if (activeTab.kind === "session") {
      const details = await getSessionCheckoutDetails(activeTab.sessionId);
      setSessionCheckout(details);
      setTablePayer((current) => current ?? details?.defaultPayer ?? null);
    }
    setItems(pending);
  }, [activeTab]);

  useEffect(() => {
    appliedDeepLinkRef.current = null;
  }, [deepLinkSessionId]);

  useEffect(() => {
    if (!deepLinkSessionId || tabs.length === 0) return;
    if (appliedDeepLinkRef.current === deepLinkSessionId) return;

    const tab = tabs.find(
      (row) => row.kind === "session" && row.sessionId === deepLinkSessionId
    );
    if (!tab) return;

    appliedDeepLinkRef.current = deepLinkSessionId;
    void expandTab(tab, { scroll: true, focus: true, syncUrl: false });
  }, [deepLinkSessionId, expandTab, tabs]);

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

  const settle = () => {
    if (!activeTab) return;
    if (needsCustomerPicker && !checkoutCustomer) return;
    if (activeTab.kind === "customer" && !checkoutCustomer) return;
    startTransition(async () => {
      const formData = new FormData();
      const allocations = items.map((item) => ({
        entryId: item.entry.id,
        amount: item.contributionAmount,
      }));
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
        appliedDeepLinkRef.current = null;
        collapseTab();
        router.replace("/checkout", { scroll: false });
        router.refresh();
      } else {
        setError(result.error ?? "Settlement failed");
      }
    });
  };

  const renderGroup = (
    title: string,
    groupItems: CustomerPendingItemDTO[]
  ) =>
    groupItems.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </p>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {groupItems.map((item) => (
            <li
              key={`${item.entry.id}-${item.contributionAmount}`}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {getEntryDisplayLabel(item.entry)}
                </p>
                <p className="text-xs text-gray-500">
                  {sectionLabel(item.entry.section)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                {formatCurrency(item.contributionAmount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );

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
        className={cn(
          "overflow-hidden rounded-xl border bg-white shadow-sm",
          expanded ? "border-emerald-300 ring-1 ring-emerald-100" : "border-gray-200"
        )}
      >
        <button
          type="button"
          onClick={() => void toggleRow(tab)}
          className={cn(
            "flex w-full gap-3 px-3 py-3 text-left transition-colors sm:px-4 sm:py-3.5",
            expanded ? "bg-emerald-50/80" : "hover:bg-gray-50"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8",
              expanded
                ? "bg-emerald-800 text-white"
                : "bg-gray-100 text-gray-600"
            )}
            aria-hidden
          >
            {expanded ? "−" : "+"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {tab.kind === "customer" ? (
                  <Link
                    href={`/customers/${tab.customerId}`}
                    className="block text-sm font-bold leading-snug text-gray-900 hover:text-emerald-800 sm:text-base"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {title}
                  </Link>
                ) : (
                  <p className="text-sm font-bold leading-snug text-gray-900 sm:text-base">
                    {title}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900 sm:text-base">
                {formatCurrency(tab.pendingAmount)}
              </p>
            </div>
            {(subtitle.primary || subtitle.secondary) && (
              <>
                {subtitle.primary ? (
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    {subtitle.primary}
                  </p>
                ) : null}
                {subtitle.secondary ? (
                  <p className="text-xs text-gray-400">{subtitle.secondary}</p>
                ) : null}
              </>
            )}
          </div>
        </button>

        {expanded && (
          <div
            className={cn(
              "border-t border-gray-200 bg-gray-50",
              tab.kind === "session" ? "px-3 py-3" : "space-y-4 px-4 py-4"
            )}
          >
            {loading ? (
              <p className="py-6 text-center text-sm text-gray-500">
                Loading bill…
              </p>
            ) : (
              <>
                {tab.kind === "session" && sessionCheckout ? (
                  <SessionCheckoutPanel
                    tab={tab as SessionOpenTabSummaryDTO}
                    details={sessionCheckout}
                    total={total}
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
                    onPayClick={() => {
                      if (method === "WALLET") {
                        setStep("wallet-verify");
                      } else {
                        setStep("confirm");
                      }
                    }}
                    onWalletVerified={(customer, vMethod) => {
                      setWalletPayer(customer);
                      setVerificationMethod(vMethod);
                      setStep("wallet-confirm");
                    }}
                    onWalletConfirm={() => setStep("confirm")}
                    onWalletBack={() => setStep("wallet-verify")}
                    onConfirmPayment={settle}
                    onBackToReview={() => setStep("review")}
                  />
                ) : tab.kind === "session" ? (
                  <p className="py-4 text-center text-sm text-gray-500">
                    Unable to load session bill.
                  </p>
                ) : (
                  <>
                    <div className="space-y-4">
                      {renderGroup("Snooker", grouped.snooker)}
                      {renderGroup("Pool / Mini", grouped.poolMini)}
                      {renderGroup("Cafe", grouped.cafe)}
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Total due
                      </span>
                      <span className="text-lg font-bold tabular-nums text-gray-900">
                        {formatCurrency(total)}
                      </span>
                    </div>

                    {step === "review" && (
                      <div className="space-y-3">
                        {needsCustomerPicker && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <p className="text-sm font-semibold text-amber-900">
                              {isSessionTab
                                ? "Session bill — select customer"
                                : "Table bill — select customer"}
                            </p>
                            <p className="mt-0.5 text-xs text-amber-800">
                              Game and cafe items for this table will be assigned
                              to the paying customer.
                            </p>
                            {checkoutCustomer ? (
                              <p className="mt-2 text-sm font-medium text-gray-900">
                                {checkoutCustomer.name}
                              </p>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="mt-2"
                              data-checkout-action="select-customer"
                              onClick={() => setShowTableCustomer(true)}
                            >
                              {checkoutCustomer
                                ? "Change customer"
                                : "Select customer"}
                            </Button>
                          </div>
                        )}
                        <p className="text-sm font-semibold text-gray-700">
                          Payment method
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {PAYMENT_METHODS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setMethod(option.id)}
                              className={cn(
                                "rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                                method === option.id
                                  ? "border-emerald-700 bg-emerald-800 text-white shadow-sm"
                                  : "border-gray-300 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <Button
                          type="button"
                          fullWidth
                          size="lg"
                          className="text-base"
                          data-checkout-action="pay"
                          disabled={needsCustomerPicker && !checkoutCustomer}
                          onClick={() => {
                            if (method === "WALLET") {
                              setStep("wallet-verify");
                            } else {
                              setStep("confirm");
                            }
                          }}
                        >
                          Pay {formatCurrency(total)}
                        </Button>
                      </div>
                    )}

                    {step === "wallet-verify" && checkoutCustomer && (
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
                    )}

                    {step === "wallet-confirm" &&
                      walletPayer &&
                      verificationMethod && (
                        <WalletCustomerConfirmation
                          customer={walletPayer}
                          verificationMethod={verificationMethod}
                          onConfirm={() => setStep("confirm")}
                          onBack={() => setStep("wallet-verify")}
                        />
                      )}

                    {step === "confirm" && (
                      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
                        <p className="text-sm font-semibold text-gray-900">
                          Confirm payment
                        </p>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-500">Customer</dt>
                            <dd className="font-medium text-gray-900">
                              {checkoutCustomer?.name ?? title}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-gray-500">Method</dt>
                            <dd className="font-medium text-gray-900">
                              {method === "CASH"
                                ? "Cash"
                                : method === "GPAY"
                                  ? "GPay"
                                  : "Wallet"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
                            <dt className="font-semibold text-gray-700">
                              Amount
                            </dt>
                            <dd className="text-base font-bold tabular-nums text-gray-900">
                              {formatCurrency(total)}
                            </dd>
                          </div>
                        </dl>
                        {error && (
                          <p className="text-sm text-red-600">{error}</p>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            fullWidth
                            size="lg"
                            disabled={isPending}
                            onClick={settle}
                          >
                            {isPending ? "Processing…" : "Confirm payment"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            fullWidth
                            onClick={() => setStep("review")}
                          >
                            Back
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  const renderSection = (
    title: string,
    summary: { billCount: number; subtotal: number },
    sectionTabs: OpenTabSummaryDTO[]
  ) => (
    <section className="min-w-0 flex-1 space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {summary.billCount} bill{summary.billCount === 1 ? "" : "s"} ·{" "}
          {formatCurrency(summary.subtotal)}
        </p>
      </div>
      {sectionTabs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-xs text-gray-500">
          No pending bills
        </p>
      ) : (
        <ul className="space-y-3">{sectionTabs.map(renderTabCard)}</ul>
      )}
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-600">
          {tabs.length} pending {tabs.length === 1 ? "bill" : "bills"}
        </span>
        <span className="text-base font-bold tabular-nums text-gray-900">
          {formatCurrency(totalPending)}
        </span>
      </div>

      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="min-w-0 flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, or card ID"
            className="text-sm"
          />
        </form>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => setShowQuickCustomer(true)}
        >
          + Quick Customer
        </Button>
      </div>

      {tabs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
          <p className="text-sm text-gray-500">No pending bills.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:gap-6">
          {renderSection(
            "Big Snooker",
            checkoutGroups.summaries.bigSnooker,
            checkoutGroups.bigSnooker
          )}
          {renderSection(
            "Pool & Mini",
            checkoutGroups.summaries.poolMini,
            checkoutGroups.poolMini
          )}
          {renderSection(
            "Customers",
            checkoutGroups.summaries.customers,
            checkoutGroups.customers
          )}
        </div>
      )}

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
    </div>
  );
}
