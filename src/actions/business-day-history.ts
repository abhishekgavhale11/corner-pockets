"use server";

import { requireStaff } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import {
  getBusinessDayHistoryDetail,
  getClosedBusinessDayHistoryList,
} from "@/lib/business-day/history";
import { getOutstandingCollectionLedger } from "@/lib/outstanding/collection-ledger";
import type {
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryListResultDTO,
  OutstandingCollectionLedgerResultDTO,
} from "@/types";

export async function getBusinessDayHistoryListAction(options?: {
  from?: string;
  to?: string;
}): Promise<BusinessDayHistoryListResultDTO> {
  await requireStaff();
  await connectDB();
  return getClosedBusinessDayHistoryList(options);
}

export async function getBusinessDayHistoryDetailAction(
  businessDayId: string
): Promise<BusinessDayHistoryDetailDTO | null> {
  await requireStaff();
  await connectDB();
  return getBusinessDayHistoryDetail(businessDayId);
}

export async function getOutstandingCollectionLedgerAction(options?: {
  from?: string;
  to?: string;
}): Promise<OutstandingCollectionLedgerResultDTO> {
  await requireStaff();
  await connectDB();
  return getOutstandingCollectionLedger(options);
}
