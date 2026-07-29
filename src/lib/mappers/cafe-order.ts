import {
  cafeItemLineAmount,
  type CafeItemType,
  type CafeOrderStatus,
  type CafePaymentMethod,
} from "@/lib/constants/cafe";
import type { ICafeOrder, ICafeOrderItem } from "@/models/CafeOrder";
import { paymentReceiptDtoFields } from "@/lib/utils/payment-receipt";

export interface CafeOrderItemDTO {
  id: string;
  type: CafeItemType;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  amount: number;
}

export interface CafeOrderDTO {
  id: string;
  businessDayId: string;
  businessDate: string;
  customerId?: string;
  customerName: string;
  status: CafeOrderStatus;
  items: CafeOrderItemDTO[];
  amount: number;
  received: number;
  paymentMethod?: CafePaymentMethod;
  itemCount: number;
  receivedByStaffId?: string;
  receivedByUsername?: string;
  receivedAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

function toItemDTO(item: ICafeOrderItem & { _id?: { toString(): string } }): CafeOrderItemDTO {
  return {
    id: item._id?.toString() ?? "",
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    description: item.description,
    amount: cafeItemLineAmount(item),
  };
}

export function toCafeOrderDTO(
  order: ICafeOrder | (ICafeOrder & Record<string, unknown>)
): CafeOrderDTO {
  const items = (order.items ?? []).map((item) =>
    toItemDTO(item as ICafeOrderItem & { _id?: { toString(): string } })
  );
  const amount = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: order._id.toString(),
    businessDayId: order.businessDayId.toString(),
    businessDate:
      order.businessDate instanceof Date
        ? order.businessDate.toISOString()
        : String(order.businessDate),
    customerId: order.customerId?.toString(),
    customerName: order.customerName,
    status: order.status,
    items,
    amount,
    received: order.received ?? 0,
    paymentMethod: order.paymentMethod,
    itemCount: items.length,
    ...paymentReceiptDtoFields(order),
    createdBy: order.createdBy,
    updatedBy: order.updatedBy,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function normalizeCafeItems(
  items: Array<{
    type: CafeItemType;
    quantity?: number;
    unitPrice?: number;
    description?: string;
    amount?: number;
  }>
): Array<{
  type: CafeItemType;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  amount: number;
}> {
  return items.map((item) => {
    if (item.type === "CIGARETTE" || item.type === "WATER") {
      const quantity = item.quantity ?? 1;
      const unitPrice = item.unitPrice ?? 0;
      return {
        type: item.type,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      };
    }
    return {
      type: item.type,
      description: item.description?.trim() ?? "",
      amount: item.amount ?? 0,
    };
  });
}
