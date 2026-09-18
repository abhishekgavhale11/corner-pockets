"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { generateCardId } from "@/lib/customers/card-id";
import Customer from "@/models/Customer";
import {
  createCustomerSchema,
  customerSearchSchema,
  deleteCustomerSchema,
  updateCustomerDetailsSchema,
  updateStudentStatusSchema,
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
import { phoneVerificationSchema } from "@/lib/validators/customer";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import { formatCustomerFullName, nameMatchRegex } from "@/lib/utils/customer-name";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type {
  CustomerDTO,
  CustomerListResult,
  CustomerListRowDTO,
} from "@/types";
import Outstanding from "@/models/Outstanding";
import NotebookEntry from "@/models/NotebookEntry";
import mongoose from "mongoose";

/**
 * Same first name is fine; same first name AND same surname (case-insensitive)
 * on another active customer is not — prevents duplicate customer records.
 */
async function findDuplicateNameCustomer(
  firstName: string,
  lastName: string,
  excludeId?: string
) {
  const query: Record<string, unknown> = {
    isActive: true,
    firstName: nameMatchRegex(firstName),
    lastName: nameMatchRegex(lastName),
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return Customer.findOne(query).select("_id").lean();
}

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

function compareCustomerNames(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function phoneSortNumber(phone: string | undefined): bigint | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return BigInt(digits);
}

function sortCustomersForList<
  T extends { _id: mongoose.Types.ObjectId; name: string; phone?: string },
>(
  customers: T[],
  outstandingById: Map<string, number>,
  sortKey: "name" | "phone" | "outstanding",
  sortDir: "asc" | "desc"
): T[] {
  const multiplier = sortDir === "asc" ? 1 : -1;
  return [...customers].sort((a, b) => {
    if (sortKey === "phone") {
      const aNum = phoneSortNumber(a.phone);
      const bNum = phoneSortNumber(b.phone);
      if (aNum === null && bNum !== null) return 1;
      if (bNum === null && aNum !== null) return -1;
      if (aNum !== null && bNum !== null && aNum !== bNum) {
        return (aNum < bNum ? -1 : 1) * multiplier;
      }
    } else if (sortKey === "outstanding") {
      const diff =
        (outstandingById.get(a._id.toString()) ?? 0) -
        (outstandingById.get(b._id.toString()) ?? 0);
      if (diff !== 0) return diff * multiplier;
    } else {
      const byName = compareCustomerNames(a.name, b.name);
      if (byName !== 0) return byName * multiplier;
      return a._id.toString().localeCompare(b._id.toString()) * multiplier;
    }

    const byName = compareCustomerNames(a.name, b.name);
    if (byName !== 0) return byName;
    return a._id.toString().localeCompare(b._id.toString());
  });
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
    sort: typeof searchParams.sort === "string" ? searchParams.sort : undefined,
    dir: typeof searchParams.dir === "string" ? searchParams.dir : undefined,
  });

  const { query, page, limit, filter: filterType, sort, dir } = parsed.success
    ? parsed.data
    : {
        query: undefined,
        filter: "all" as const,
        page: 1,
        limit: 20,
        sort: undefined,
        dir: undefined,
      };

  const sortKey =
    sort === "phone" || sort === "outstanding" || sort === "name"
      ? sort
      : "name";
  const sortDir: "asc" | "desc" =
    dir === "asc" || dir === "desc"
      ? dir
      : sort === "outstanding"
        ? "desc"
        : "asc";

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

  const [matchingCustomers, allCount, outstandingCount] = await Promise.all([
    Customer.find(listFilter).select("name phone").lean(),
    Customer.countDocuments(baseFilter),
    Customer.countDocuments({
      ...baseFilter,
      _id: { $in: outstandingIds },
    }),
  ]);

  const outstandingById = await loadOutstandingTotalsByCustomer(
    matchingCustomers.map((customer) => customer._id)
  );

  const customers = sortCustomersForList(
    matchingCustomers,
    outstandingById,
    sortKey,
    sortDir
  ).slice(skip, skip + limit);

  const items = await enrichCustomerListRows(customers);
  const total = matchingCustomers.length;

  let totalOutstanding = 0;
  for (const amount of outstandingById.values()) {
    totalOutstanding += amount;
  }

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    limit,
    allCount,
    outstandingCount,
    totalOutstanding,
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

  const duplicateName = await findDuplicateNameCustomer(firstName, lastName);
  if (duplicateName) {
    return failure("A customer with this name and surname already exists");
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

  if (currentFirstName !== firstName || currentLastName !== lastName) {
    const duplicateName = await findDuplicateNameCustomer(
      firstName,
      lastName,
      customer._id.toString()
    );
    if (duplicateName) {
      return failure("A customer with this name and surname already exists");
    }
  }

  if (nextCardId !== currentCardId) {
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

  if (nextCardId !== currentCardId) {
    changes.push({ field: "cardId", from: currentCardId, to: nextCardId });
  }

  customer.firstName = firstName;
  customer.lastName = lastName;
  customer.name = name;
  customer.phone = phone;
  customer.cardId = nextCardId;
  if (changes.length > 0) {
    customer.detailChanges.push({
      changedAt: new Date(),
      changedBy: authResult.session.user.username,
      changes,
    });
  }
  await customer.save();

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath("/customers");
  revalidateCounterPaths(parsed.data.customerId);
  revalidatePath("/business-day/history");
  revalidatePath("/business-day/history/[id]");

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

  const duplicateName = await findDuplicateNameCustomer(firstName, lastName);
  if (duplicateName) {
    return failure("A customer with this name and surname already exists");
  }

  let customer;
  try {
    customer = await Customer.create({
      firstName,
      lastName,
      name,
      ...(phone ? { phone } : {}),
      isStudent: false,
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

export async function deleteCustomer(
  formData: FormData
): Promise<ActionResult<void>> {
  const authResult = await authorizePermission("CUSTOMER_DELETE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = deleteCustomerSchema.safeParse({
    customerId: formData.get("customerId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  customer.isActive = false;
  await customer.save();

  revalidateCounterPaths(parsed.data.customerId);
  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.data.customerId}`);

  return success(undefined);
}

