"use client";



import {

  correctCafeEntry,

  setEntryContributors,

  updatePoolMiniEntry,

  updateSnookerFrameEntry,

} from "@/actions/notebook-entries";

import { updateCafeOrderAction } from "@/actions/cafe-orders";

import {

  contributorRowsToPayload,

  type ContributorRow,

} from "@/components/counter/ContributorsSplitFields";

import {

  appendEntryPaymentFormData,

  resolveEntryPaymentSubmit,

  type EntryPaymentMode,

} from "@/components/counter/EntryPaymentFields";

import { isQtyCafeItemType } from "@/lib/constants/cafe";

import { CAFE_SECTION, isBigSnookerSection } from "@/lib/constants/counter-sections";

import { entryHasContributors } from "@/lib/utils/entry-contributors";

import {

  frameDueFromParts,

  framePaidAmount,

} from "@/lib/utils/frame-payment";

import { toTimeInputValue } from "@/lib/utils/format-time";

import { isPoolMiniEntry } from "@/lib/utils/pool-mini-entry";

import { entryToSnookerFrameType } from "@/lib/utils/snooker-frame";

import type { CafeOrderDTO } from "@/lib/mappers/cafe-order";

import type { CustomerCounterDrawerDTO, NotebookEntryDTO } from "@/types";



export type MarkRemainingPaymentInput = {

  paymentMode: EntryPaymentMode;

};



function lineAmountsForCustomer(

  entry: NotebookEntryDTO,

  customerId: string

): {

  amount: number;

  paidAmount?: number;

  balanceCollectedAmount?: number;

} {

  const contributor = entry.contributors?.find(

    (row) => row.customerId === customerId

  );

  if (contributor) {

    return {

      amount: contributor.amount,

      paidAmount: contributor.paidAmount,

      balanceCollectedAmount: contributor.balanceCollectedAmount,

    };

  }

  return {

    amount: entry.amount,

    paidAmount: entry.paidAmount,

    balanceCollectedAmount: entry.balanceCollectedAmount,

  };

}



function isLegacyCafeOrder(order: CafeOrderDTO): boolean {

  return !order.businessDayId;

}



function cafeOrderItemsPayload(order: CafeOrderDTO) {

  return order.items.map((item) => {

    if (isQtyCafeItemType(item.type)) {

      return {

        type: item.type,

        quantity: item.quantity ?? 1,

        unitPrice: item.unitPrice ?? 0,

      };

    }

    return {

      type: item.type,

      description: item.description ?? "",

      amount: item.amount,

    };

  });

}



function buildContributorRowsForPayment(

  entry: NotebookEntryDTO,

  customerId: string,

  payment: MarkRemainingPaymentInput

): ContributorRow[] {

  return (entry.contributors ?? []).map((contributor) => {

    const isTarget = contributor.customerId === customerId;

    const due = frameDueFromParts(

      contributor.amount,

      contributor.paidAmount,

      contributor.balanceCollectedAmount

    );

    const fullyPaid = isTarget && due > 0;



    let paymentMethod: ContributorRow["paymentMethod"] =

      contributor.paymentMethod === "CASH" ||

      contributor.paymentMethod === "GPAY"

        ? contributor.paymentMethod

        : "";



    if (fullyPaid) {

      paymentMethod = payment.paymentMode;

    }



    return {

      customerId: contributor.customerId,

      customerName: contributor.customerName,

      amount: String(contributor.amount),

      paidAmount: String(

        fullyPaid ? contributor.amount : framePaidAmount(contributor.paidAmount)

      ),

      paymentMethod,

    };

  });

}



async function payFrameEntry(

  entry: NotebookEntryDTO,

  customerId: string,

  payment: MarkRemainingPaymentInput

): Promise<{ ok: true } | { ok: false; error: string }> {

  const line = lineAmountsForCustomer(entry, customerId);

  const due = frameDueFromParts(

    line.amount,

    line.paidAmount,

    line.balanceCollectedAmount

  );

  if (due <= 0) {

    return { ok: true };

  }



  if (entryHasContributors(entry)) {

    const rows = buildContributorRowsForPayment(entry, customerId, payment);

    for (const row of rows) {

      const paidAmount = Number.parseInt(row.paidAmount || "0", 10) || 0;

      const resolved = resolveEntryPaymentSubmit({

        paidAmount,

        paymentMode: row.paymentMethod,

      });

      if (!resolved.valid) {

        return {

          ok: false,

          error: resolved.error ?? "Select a valid payment mode",

        };

      }

    }



    const formData = new FormData();

    formData.set("entryId", entry.id);

    formData.set(

      "contributors",

      JSON.stringify(contributorRowsToPayload(rows))

    );

    const result = await setEntryContributors(formData);

    return result.success

      ? { ok: true }

      : { ok: false, error: result.error };

  }



  const paidAmount = line.amount;

  const paymentCheck = resolveEntryPaymentSubmit({

    paidAmount,

    paymentMode: payment.paymentMode,

  });

  if (!paymentCheck.valid) {

    return {

      ok: false,

      error: paymentCheck.error ?? "Select a valid payment mode",

    };

  }



  if (isPoolMiniEntry(entry)) {

    const formData = new FormData();

    formData.set("entryId", entry.id);

    formData.set("amount", String(entry.amount));

    formData.set(

      "startTime",

      toTimeInputValue(entry.playStartedAt ?? entry.createdAt)

    );

    if (entry.playEndedAt) {

      formData.set("endTime", toTimeInputValue(entry.playEndedAt));

    }

    formData.set("notes", entry.notes ?? "");

    formData.set("customerId", customerId);

    const paymentFields = appendEntryPaymentFormData(formData, {

      paidAmount,

      paymentMode: payment.paymentMode,

    });

    if (!paymentFields.ok) {

      return { ok: false, error: paymentFields.error };

    }

    const result = await updatePoolMiniEntry(formData);

    return result.success

      ? { ok: true }

      : { ok: false, error: result.error };

  }



  if (!isBigSnookerSection(entry.section)) {

    return { ok: false, error: "Unsupported frame type for payment" };

  }



  const frameType = entryToSnookerFrameType(entry);

  if (!frameType) {

    return { ok: false, error: "Could not determine frame type" };

  }



  const formData = new FormData();

  formData.set("entryId", entry.id);

  formData.set("frameType", frameType);

  formData.set("amount", String(entry.amount));

  formData.set("entryTime", toTimeInputValue(entry.createdAt));

  if (frameType === "RUMMY" && entry.playerCount) {

    formData.set("playerCount", String(entry.playerCount));

  }

  formData.set("customerId", customerId);

  const paymentFields = appendEntryPaymentFormData(formData, {

    paidAmount,

    paymentMode: payment.paymentMode,

  });

  if (!paymentFields.ok) {

    return { ok: false, error: paymentFields.error };

  }



  const result = await updateSnookerFrameEntry(formData);

  return result.success ? { ok: true } : { ok: false, error: result.error };

}



async function payCafeOrder(

  order: CafeOrderDTO,

  payment: MarkRemainingPaymentInput

): Promise<{ ok: true } | { ok: false; error: string }> {

  const due = frameDueFromParts(order.amount, order.received);

  if (due <= 0) {

    return { ok: true };

  }



  const received = order.amount;

  const paymentCheck = resolveEntryPaymentSubmit({

    paidAmount: received,

    paymentMode: payment.paymentMode,

  });

  if (!paymentCheck.valid) {

    return {

      ok: false,

      error: paymentCheck.error ?? "Select a valid payment mode",

    };

  }



  if (isLegacyCafeOrder(order)) {

    const formData = new FormData();

    formData.set("entryId", order.id);

    const paymentFields = appendEntryPaymentFormData(formData, {

      paidAmount: received,

      paymentMode: payment.paymentMode,

    });

    if (!paymentFields.ok) {

      return { ok: false, error: paymentFields.error };

    }

    const result = await correctCafeEntry(formData);

    return result.success

      ? { ok: true }

      : { ok: false, error: result.error };

  }



  const resolved = resolveEntryPaymentSubmit({

    paidAmount: received,

    paymentMode: payment.paymentMode,

  });



  const result = await updateCafeOrderAction({

    orderId: order.id,

    items: cafeOrderItemsPayload(order),

    received,

    paymentMethod: resolved.paymentMethod,

  });



  return result.success ? { ok: true } : { ok: false, error: result.error };

}



/**

 * Marks every unpaid/partially-paid frame and cafe line for this customer

 * using the same server actions as individual Counter edits.

 */

export async function markCustomerRemainingAsPaid(

  summary: CustomerCounterDrawerDTO,

  payment: MarkRemainingPaymentInput

): Promise<{ ok: true } | { ok: false; error: string }> {

  if (summary.totalDue <= 0) {

    return { ok: true };

  }



  if (payment.paymentMode !== "CASH" && payment.paymentMode !== "GPAY") {

    return { ok: false, error: "Select Cash or GPay" };

  }



  for (const entry of summary.todaysFrames) {

    if (entry.section === CAFE_SECTION) continue;

    const result = await payFrameEntry(entry, summary.customerId, payment);

    if (!result.ok) return result;

  }



  for (const order of summary.todaysCafeOrders) {

    const result = await payCafeOrder(order, payment);

    if (!result.ok) return result;

  }



  return { ok: true };

}

