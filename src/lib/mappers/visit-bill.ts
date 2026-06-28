import type { BillDTO, VisitDTO, ActiveVisitBillDTO } from "@/types";
import type { IBill } from "@/models/Bill";
import type { IVisit } from "@/models/Visit";

type LeanBill = Pick<
  IBill,
  | "_id"
  | "publicId"
  | "visitId"
  | "customerId"
  | "businessDate"
  | "status"
  | "totalAmount"
  | "paidAmount"
  | "dueAmount"
  | "convertedToOutstandingAt"
  | "convertedToOutstandingBy"
  | "createdBy"
  | "createdAt"
>;

type LeanVisit = Pick<
  IVisit,
  | "_id"
  | "publicId"
  | "customerId"
  | "billId"
  | "businessDate"
  | "status"
  | "startedAt"
  | "closedAt"
  | "notes"
  | "createdBy"
  | "createdAt"
>;

export function toBillDTO(bill: LeanBill): BillDTO {
  return {
    id: bill._id.toString(),
    publicId: bill.publicId,
    visitId: bill.visitId?.toString(),
    customerId: bill.customerId.toString(),
    businessDate: bill.businessDate,
    status: bill.status,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    dueAmount: bill.dueAmount,
    convertedToOutstandingAt: bill.convertedToOutstandingAt?.toISOString(),
    convertedToOutstandingBy: bill.convertedToOutstandingBy,
    createdBy: bill.createdBy,
    createdAt: bill.createdAt.toISOString(),
  };
}

export function toVisitDTO(visit: LeanVisit): VisitDTO {
  return {
    id: visit._id.toString(),
    publicId: visit.publicId,
    customerId: visit.customerId.toString(),
    billId: visit.billId.toString(),
    businessDate: visit.businessDate,
    status: visit.status,
    startedAt: visit.startedAt.toISOString(),
    closedAt: visit.closedAt?.toISOString(),
    notes: visit.notes,
    createdBy: visit.createdBy,
    createdAt: visit.createdAt.toISOString(),
  };
}

export function toActiveVisitBillDTO(input: {
  visit: LeanVisit;
  bill: LeanBill;
}): ActiveVisitBillDTO {
  return {
    visit: toVisitDTO(input.visit),
    bill: toBillDTO(input.bill),
  };
}
