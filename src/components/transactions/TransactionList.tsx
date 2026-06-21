"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { reverseTransaction } from "@/actions/transactions";
import { REVERSAL_REASONS } from "@/lib/constants/reversal-reasons";
import type { ReversalReasonKey } from "@/lib/constants/reversal-reasons";
import { verificationMethodLabel } from "@/lib/constants/verification";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { TransactionDTO } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface TransactionListProps {
  customerId: string;
  transactions: TransactionDTO[];
  canReverseTransactions?: boolean;
}

function transactionTypeLabel(tx: TransactionDTO): string {
  if (tx.isReversal) return "reversal";
  return tx.type === "credit" ? "recharge" : "debit";
}

function transactionTypeTitle(tx: TransactionDTO): string {
  if (tx.isReversal) return "Reversal";
  return tx.type === "credit" ? "Recharge" : "Debit";
}

export function TransactionList({
  customerId,
  transactions,
  canReverseTransactions = false,
}: TransactionListProps) {
  const transactionsById = new Map(
    transactions.map((tx) => [tx.id, tx])
  );

  return (
    <Card>
      <CardTitle className="mb-4">Transaction History</CardTitle>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {transactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              customerId={customerId}
              transaction={tx}
              transactionsById={transactionsById}
              canReverseTransactions={canReverseTransactions}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TransactionItem({
  customerId,
  transaction: tx,
  transactionsById,
  canReverseTransactions,
}: {
  customerId: string;
  transaction: TransactionDTO;
  transactionsById: Map<string, TransactionDTO>;
  canReverseTransactions: boolean;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [reversalReason, setReversalReason] =
    useState<ReversalReasonKey>("WRONG_AMOUNT");
  const [reversalReasonOther, setReversalReasonOther] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await reverseTransaction(formData);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
        return null;
      }
      return { error: result.error };
    },
    null
  );

  const canReverse =
    canReverseTransactions &&
    !tx.isReversal &&
    !tx.reversedAt &&
    !tx.reversesTransactionId;

  const displayType = transactionTypeTitle(tx);

  const originalTransaction =
    tx.isReversal && tx.reversesTransactionId
      ? transactionsById.get(tx.reversesTransactionId)
      : undefined;

  const reversalTransaction =
    tx.reversalTransactionId
      ? transactionsById.get(tx.reversalTransactionId)
      : undefined;

  const reversalOfLabel =
    originalTransaction &&
    `Reverses ${transactionTypeLabel(originalTransaction)} from ${formatDate(originalTransaction.createdAt)}`;

  const reversedByLabel =
    tx.reversedAt &&
    `This ${transactionTypeLabel(tx)} from ${formatDate(tx.createdAt)} was reversed on ${formatDate(tx.reversedAt)}${tx.reversedBy ? ` by ${tx.reversedBy}` : ""}${tx.reversalReason ? ` — ${tx.reversalReason}` : ""}`;

  const reversalEntryLabel =
    reversalTransaction &&
    `Reversal recorded on ${formatDate(reversalTransaction.createdAt)}`;

  const badgeVariant = tx.isReversal
    ? "neutral"
    : tx.reversedAt
      ? "neutral"
      : tx.type === "credit"
        ? "success"
        : "warning";

  return (
    <>
      <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant}>{displayType}</Badge>
            {tx.reversedAt && (
              <Badge variant="neutral">Reversed</Badge>
            )}
            <span className="text-sm text-gray-500">
              {formatDate(tx.createdAt)}
            </span>
          </div>

          {reversalOfLabel && (
            <p className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
              {reversalOfLabel}
            </p>
          )}

          {reversedByLabel && (
            <p className="mt-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
              {reversedByLabel}
              {reversalEntryLabel && (
                <span className="mt-1 block text-xs text-gray-500">
                  {reversalEntryLabel}
                </span>
              )}
            </p>
          )}

          {tx.type === "credit" && !tx.isReversal ? (
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <p>
                Paid:{" "}
                <span className="font-medium">
                  {formatCurrency(tx.paidAmount ?? 0)}
                </span>
              </p>
              <p>
                Bonus:{" "}
                <span className="font-medium text-emerald-700">
                  {formatCurrency(tx.bonusAmount ?? 0)}
                </span>
              </p>
              <p>
                Credited:{" "}
                <span className="font-medium text-emerald-800">
                  {formatCurrency(tx.creditedAmount ?? 0)}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-900">{tx.description}</p>
          )}

          <p className="mt-2 text-xs text-gray-500">
            By: {tx.staffUsername}
            {tx.verificationMethod && (
              <>
                {" "}
                · Verification: {verificationMethodLabel(tx.verificationMethod)}
              </>
            )}
          </p>
          <p className="text-xs text-gray-500">
            Balance after: {formatCurrency(tx.balanceAfter)}
          </p>

          {state?.error && (
            <p className="mt-2 text-sm text-red-600">{state.error}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          {tx.type === "debit" && (
            <p className="text-lg font-semibold text-amber-700">
              -{formatCurrency(tx.amount ?? tx.creditedAmount ?? 0)}
            </p>
          )}
          {tx.type === "credit" && tx.isReversal && (
            <p className="text-lg font-semibold text-emerald-700">
              +{formatCurrency(tx.creditedAmount ?? 0)}
            </p>
          )}

          {canReverse && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setReversalReason("WRONG_AMOUNT");
                setReversalReasonOther("");
                setShowConfirm(true);
              }}
              disabled={isPending}
            >
              Reverse Transaction
            </Button>
          )}
        </div>
      </li>

      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Reversal"
      >
        <p className="text-sm text-gray-600">
          Reverse the {transactionTypeLabel(tx)} from {formatDate(tx.createdAt)}?
          A new reversal entry will be created and this transaction will be marked
          as reversed.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor={`reversal-reason-${tx.id}`}>Reversal reason</Label>
            <select
              id={`reversal-reason-${tx.id}`}
              value={reversalReason}
              onChange={(event) =>
                setReversalReason(event.target.value as ReversalReasonKey)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              {REVERSAL_REASONS.map((reason) => (
                <option key={reason.key} value={reason.key}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {reversalReason === "OTHER" && (
            <div>
              <Label htmlFor={`reversal-reason-other-${tx.id}`}>
                Please specify
              </Label>
              <Input
                id={`reversal-reason-other-${tx.id}`}
                value={reversalReasonOther}
                onChange={(event) => setReversalReasonOther(event.target.value)}
                placeholder="Enter reversal details"
                maxLength={200}
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const formData = new FormData();
              formData.set("customerId", customerId);
              formData.set("transactionId", tx.id);
              formData.set("reversalReason", reversalReason);
              if (reversalReason === "OTHER") {
                formData.set("reversalReasonOther", reversalReasonOther);
              }
              formAction(formData);
            }}
            disabled={
              isPending ||
              (reversalReason === "OTHER" && reversalReasonOther.trim().length < 3)
            }
            fullWidth
          >
            {isPending ? "Processing..." : "Yes, Reverse"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            fullWidth
          >
            Cancel
          </Button>
        </div>
      </Dialog>
    </>
  );
}
