"use server";

import { requireStaff } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import {
  getBusinessDayHistoryDetail,
  getClosedBusinessDayHistoryList,
  getOutstandingHistoryTab,
} from "@/lib/business-day/history";
import type {
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryListResultDTO,
  OutstandingHistoryTabDTO,
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

export async function getOutstandingHistoryTabAction(options?: {
  from?: string;
  to?: string;
}): Promise<OutstandingHistoryTabDTO> {
  await requireStaff();
  await connectDB();
  return getOutstandingHistoryTab(options);
}
