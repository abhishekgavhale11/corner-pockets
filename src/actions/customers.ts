"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { generateCardId } from "@/lib/customers/card-id";
import Customer from "@/models/Customer";
import {
  createCustomerSchema,
  customerSearchSchema,
  updateCustomerDetailsSchema,
  updateStudentStatusSchema,
  enableWalletMembershipSchema,
} from "@/lib/validators/customer";
import {
  createQuickCustomerSchema,
  updateCustomerNotesSchema,
} from "@/lib/validators/notebook";
import { toCustomerDTO } from "@/lib/mappers";
import {
  normalizeCardId,
  normalizePhone,
} from "@/lib/utils/phone";
import {
  cardIdVerificationSchema,
  phoneVerificationSchema,
} from "@/lib/validators/transaction";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import { formatCustomerFullName } from "@/lib/utils/customer-name";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type {
  CustomerDTO,
  CustomerListResult,
  CustomerListRowDTO,
} from "@/types";
import Outstanding from "@/models/Outstanding";
import NotebookEntry from "@/models/NotebookEntry";
import mongoose from "mongoose";

async function loadOutstandingCustomerIds(): Promise<mongoose.Types.ObjectId[]> {
  const withOutstanding = await Outstanding.aggregate<{
    _id: mongoose.Types.ObjectId;
  }>([
    {
      $match: {
        status: "PENDING",
        remainingAmount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$customerId",
        outstandingAmount: { $sum: "$remainingAmount" },
      },
    },
    { $match: { outstandingAmount: { $gt: 0 } } },
  ]);

  return withOutstanding.map((row) => row._id);
}

async function loadOutstandingTotalsByCustomer(
  customerIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (customerIds.length === 0) return map;

  const rows = await Outstanding.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
  }>([
    {
      $match: {
        customerId: { $in: customerIds },
        status: "PENDING",
        remainingAmount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$customerId",
        total: { $sum: "$remainingAmount" },
      },
    },
  ]);

  for (const row of rows) {
    map.set(row._id.toString(), row.total);
  }
  return map;
}

async function loadLastVisitByCustomer(
  customerIds: mongoose.Types.ObjectId[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (customerIds.length === 0) return map;

  const idSet = new Set(customerIds.map((id) => id.toString()));
  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      { customerId: { $in: customerIds } },
      { "contributors.customerId": { $in: customerIds } },
    ],
  })
    .sort({ createdAt: -1 })
    .select("customerId contributors.customerId createdAt")
    .lean();

  for (const entry of entries) {
    const owners = new Set<string>();
    if (entry.customerId) {
      owners.add(entry.customerId.toString());
    }
    for (const contributor of entry.contributors ?? []) {
      if (contributor.customerId) {
        owners.add(contributor.customerId.toString());
      }
    }

    for (const ownerId of owners) {
      if (idSet.has(ownerId) && !map.has(ownerId)) {
        map.set(ownerId, entry.createdAt.toISOString());
      }
    }

    if (map.size === idSet.size) {
      break;
    }
  }

  return map;
}

async function enrichCustomerListRows(
  customers: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    phone: string;
  }>
): Promise<CustomerListRowDTO[]> {
  const ids = customers.map((c) => c._id);
  const [outstandingById, lastVisitById] = await Promise.all([
    loadOutstandingTotalsByCustomer(ids),
    loadLastVisitByCustomer(ids),
  ]);

  return customers.map((customer) => {
    const id = customer._id.toString();
    return {
      id,
      name: customer.name,
      phone: customer.phone,
      outstandingAmount: outstandingById.get(id) ?? 0,
      lastVisitAt: lastVisitById.get(id) ?? null,
    };
  });
}

export async function getCustomers(
  searchParams: Record<string, string | string[] | undefined>
): Promise<CustomerListResult> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    throw new Error(
      authResult.success === false ? authResult.error : "Unauthorized"
    );
  }

  await connectDB();

  const parsed = customerSearchSchema.safeParse({
    query: typeof searchParams.q === "string" ? searchParams.q : undefined,
    filter:
      typeof searchParams.filter === "string" ? searchParams.filter : undefined,
    page: searchParams.page,
    limit: searchParams.limit,
  });

  const { query, page, limit, filter: filterType } = parsed.success
    ? parsed.data
    : { query: undefined, filter: "all" as const, page: 1, limit: 10 };

  const baseFilter: Record<string, unknown> = { isActive: true };

  if (query?.trim()) {
    const term = query.trim();
    baseFilter.$or = [
      { name: { $regex: term, $options: "i" } },
      { firstName: { $regex: term, $options: "i" } },
      { lastName: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
    ];
  }

  const outstandingIds = await loadOutstandingCustomerIds();
  const listFilter: Record<string, unknown> = { ...baseFilter };

  if (filterType === "outstanding") {
    listFilter._id = { $in: outstandingIds };
  }

  const skip = (page - 1) * limit;

  const [customers, total, allCount, outstandingCount] = await Promise.all([
    Customer.find(listFilter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .select("name phone")
      .lean(),
    Customer.countDocuments(listFilter),
    Customer.countDocuments(baseFilter),
    Customer.countDocuments({
      ...baseFilter,
      _id: { $in: outstandingIds },
    }),
  ]);

  return {
    items: await enrichCustomerListRows(customers),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    limit,
    allCount,
    outstandingCount,
  };
}

export async function getCustomerById(
  id: string
): Promise<CustomerDTO | null> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return null;
  }

  await connectDB();

  const customer = await Customer.findById(id).lean();
  if (!customer) return null;

  return toCustomerDTO(customer);
}

/** Lightweight wallet balance for Counter payment dialogs. */
export async function getCustomerWalletInfo(
  customerId: string
): Promise<{ balance: number; walletEnabled: boolean } | null> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return null;
  }

  if (!customerId) return null;

  await connectDB();

  const customer = await Customer.findById(customerId)
    .select("balance walletEnabled")
    .lean();
  if (!customer) return null;

  return {
    balance: customer.balance ?? 0,
    walletEnabled: customer.walletEnabled ?? false,
  };
}

export async function createCustomer(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("CUSTOMER_REGISTER");
  if (!("session" in authResult)) {
    return authResult;
  }

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    isStudent: formData.get("isStudent"),
  };

  const parsed = createCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const phone = parsed.data.phone.trim();
  const firstName = parsed.data.firstName;
  const lastName = parsed.data.lastName;
  const name = formatCustomerFullName(firstName, lastName);

  const existing = await Customer.findOne({ phone });
  if (existing) {
    return failure("A customer with this phone number already exists");
  }

  try {
    const cardId = await generateCardId();

    const customer = await Customer.create({
      cardId,
      firstName,
      lastName,
      name,
      phone,
      isStudent: parsed.data.isStudent ?? false,
      balance: 0,
      walletEnabled: true,
    });

    revalidatePath("/customers");

    return success(toCustomerDTO(customer));
  } catch {
    return failure("Failed to create customer");
  }
}

export async function updateStudentStatus(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("CUSTOMER_STUDENT_STATUS");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateStudentStatusSchema.safeParse({
    customerId: formData.get("customerId"),
    isStudent: formData.get("isStudent"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  if (customer.isStudent === parsed.data.isStudent) {
    return failure("Student status is already set to this value");
  }

  customer.isStudent = parsed.data.isStudent;
  customer.studentStatusChangedAt = new Date();
  customer.studentStatusChangedBy = authResult.session.user.username;
  await customer.save();

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath(`/customers/${parsed.data.customerId}/recharge`);
  revalidatePath("/customers");

  return success(toCustomerDTO(customer));
}

export async function updateCustomerDetails(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("CUSTOMER_EDIT_DETAILS");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateCustomerDetailsSchema.safeParse({
    customerId: formData.get("customerId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    cardId: formData.get("cardId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const firstName = parsed.data.firstName;
  const lastName = parsed.data.lastName;
  const name = formatCustomerFullName(firstName, lastName);
  const phone = parsed.data.phone.trim();
  const nextCardId = parsed.data.cardId
    ? normalizeCardId(parsed.data.cardId)
    : "";

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  const currentCardId = customer.cardId?.trim() ?? "";
  const currentFirstName = (customer.firstName ?? "").trim();
  const currentLastName = (customer.lastName ?? "").trim();

  if (customer.walletEnabled && !nextCardId) {
    return failure("Card ID is required for wallet members");
  }

  if (
    customer.name === name &&
    currentFirstName === firstName &&
    currentLastName === lastName &&
    customer.phone === phone &&
    currentCardId === nextCardId
  ) {
    return failure("No changes to save");
  }

  if (phone !== customer.phone) {
    const existing = await Customer.findOne({
      phone,
      _id: { $ne: customer._id },
    });
    if (existing) {
      return failure("A customer with this phone number already exists");
    }
  }

  if (customer.walletEnabled && nextCardId !== currentCardId) {
    const existingCard = await Customer.findOne({
      cardId: nextCardId,
      _id: { $ne: customer._id },
    });
    if (existingCard) {
      return failure("A customer with this Card ID already exists");
    }
  }

  const changes: { field: "name" | "phone" | "cardId"; from: string; to: string }[] =
    [];

  if (customer.name !== name) {
    changes.push({ field: "name", from: customer.name, to: name });
  }

  if (customer.phone !== phone) {
    changes.push({ field: "phone", from: customer.phone, to: phone });
  }

  if (customer.walletEnabled && nextCardId !== currentCardId) {
    changes.push({ field: "cardId", from: currentCardId, to: nextCardId });
  }

  customer.firstName = firstName;
  customer.lastName = lastName;
  customer.name = name;
  customer.phone = phone;
  if (customer.walletEnabled) {
    customer.cardId = nextCardId;
  }
  if (changes.length > 0) {
    customer.detailChanges.push({
      changedAt: new Date(),
      changedBy: authResult.session.user.username,
      changes,
    });
  }
  await customer.save();

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath(`/customers/${parsed.data.customerId}/recharge`);
  revalidatePath(`/customers/${parsed.data.customerId}/deduct`);
  revalidatePath(`/customers/${parsed.data.customerId}/transactions`);
  revalidatePath("/customers");

  return success(toCustomerDTO(customer));
}

export async function verifyCustomerByCardId(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = cardIdVerificationSchema.safeParse({
    cardId: formData.get("cardId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const cardId = normalizeCardId(parsed.data.cardId);
  const customer = await Customer.findOne({
    cardId,
    isActive: true,
    walletEnabled: true,
  }).lean();

  if (!customer) {
    return failure("No wallet member found with this Card ID");
  }

  return success(toCustomerDTO(customer));
}

export async function verifyCustomersByPhone(
  formData: FormData
): Promise<ActionResult<CustomerDTO[]>> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = phoneVerificationSchema.safeParse({
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const phone = normalizePhone(parsed.data.phone);
  const customers = await Customer.find({
    phone,
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  if (customers.length === 0) {
    return failure("No active customer found with this phone number");
  }

  return success(customers.map((customer) => toCustomerDTO(customer)));
}

export async function createQuickCustomer(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createQuickCustomerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const phone = parsed.data.phone.trim();
  const firstName = parsed.data.firstName;
  const lastName = parsed.data.lastName;
  const name = formatCustomerFullName(firstName, lastName);

  if (phone) {
    const existing = await Customer.findOne({ phone });
    if (existing) {
      return failure("A customer with this phone number already exists");
    }
  }

  let customer;
  try {
    customer = await Customer.create({
      firstName,
      lastName,
      name,
      ...(phone ? { phone } : {}),
      isStudent: false,
      balance: 0,
      walletEnabled: false,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return failure("A customer with this phone number already exists");
    }

    console.error("createQuickCustomer failed:", error);
    return failure("Failed to create customer");
  }

  revalidatePath("/customers");
  revalidateCounterPaths(customer._id.toString());

  return success(toCustomerDTO(customer));
}

/** @deprecated Use createQuickCustomer */
export async function createNotebookCustomer(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  return createQuickCustomer(formData);
}

export async function updateCustomerNotes(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_ENTRY_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateCustomerNotesSchema.safeParse({
    customerId: formData.get("customerId"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  customer.notes = parsed.data.notes.trim();
  await customer.save();

  revalidatePath(`/customers/${customer._id.toString()}`);

  return success(toCustomerDTO(customer));
}

export async function enableWalletMembership(
  formData: FormData
): Promise<ActionResult<CustomerDTO>> {
  const authResult = await authorizePermission("CUSTOMER_REGISTER");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = enableWalletMembershipSchema.safeParse({
    customerId: formData.get("customerId"),
    phone: formData.get("phone") || undefined,
    isStudent: formData.get("isStudent"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  if (customer.walletEnabled) {
    return failure("Customer already has wallet membership");
  }

  const phone = parsed.data.phone?.trim() || customer.phone.trim();
  if (!phone) {
    return failure("Phone number is required for wallet membership");
  }

  const duplicate = await Customer.findOne({
    phone,
    _id: { $ne: customer._id },
  });
  if (duplicate) {
    return failure("A customer with this phone number already exists");
  }

  customer.phone = phone;
  if (!customer.cardId?.trim()) {
    customer.cardId = await generateCardId();
  }
  customer.walletEnabled = true;
  customer.isStudent = parsed.data.isStudent ?? false;
  if (customer.isStudent) {
    customer.studentStatusChangedAt = new Date();
    customer.studentStatusChangedBy = authResult.session.user.username;
  }
  await customer.save();

  revalidatePath("/customers");
  revalidatePath(`/customers/${customer._id.toString()}`);

  return success(toCustomerDTO(customer));
}
