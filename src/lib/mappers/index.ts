import type { CustomerDTO } from "@/types";
import { resolveCustomerNameParts } from "@/lib/utils/customer-name";

type LeanCustomerDetailFieldChange = {
  field: "name" | "phone" | "cardId";
  from: string;
  to: string;
};

type LeanCustomerDetailChange = {
  changedAt: Date;
  changedBy: string;
  changes: LeanCustomerDetailFieldChange[];
};

type LeanCustomer = {
  _id: { toString(): string };
  cardId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  notes?: string;
  isStudent: boolean;
  studentStatusChangedAt?: Date;
  studentStatusChangedBy?: string;
  detailChanges?: LeanCustomerDetailChange[];
  isActive: boolean;
  createdAt: Date;
};

export function toCustomerDTO(customer: LeanCustomer): CustomerDTO {
  const detailChanges = [...(customer.detailChanges ?? [])].sort(
    (a, b) => b.changedAt.getTime() - a.changedAt.getTime()
  );
  const names = resolveCustomerNameParts(customer);

  return {
    id: customer._id.toString(),
    cardId: customer.cardId ?? "",
    name: names.name,
    firstName: names.firstName,
    lastName: names.lastName,
    phone: customer.phone,
    notes: customer.notes,
    isStudent: customer.isStudent,
    studentStatusChangedAt: customer.studentStatusChangedAt?.toISOString(),
    studentStatusChangedBy: customer.studentStatusChangedBy,
    detailChanges: detailChanges.map((entry) => ({
      changedAt: entry.changedAt.toISOString(),
      changedBy: entry.changedBy,
      changes: entry.changes.map((change) => ({
        field: change.field,
        from: change.from,
        to: change.to,
      })),
    })),
    isActive: customer.isActive,
    createdAt: customer.createdAt.toISOString(),
  };
}
