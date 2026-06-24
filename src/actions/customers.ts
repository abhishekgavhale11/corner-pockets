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
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import {
  normalizeCardId,
  normalizePhone,
} from "@/lib/utils/phone";
import {
  cardIdVerificationSchema,
  phoneVerificationSchema,
} from "@/lib/validators/transaction";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import type { CustomerDTO, PaginatedResult } from "@/types";

export async function getCustomers(
  searchParams: Record<string, string | string[] | undefined>
): Promise<PaginatedResult<CustomerDTO>> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    throw new Error(
      authResult.success === false ? authResult.error : "Unauthorized"
    );
  }

  await connectDB();

  const parsed = customerSearchSchema.safeParse({
    query: typeof searchParams.q === "string" ? searchParams.q : undefined,
    filter: typeof searchParams.filter === "string" ? searchParams.filter : undefined,
    page: searchParams.page,
    limit: searchParams.limit,
  });

  const { query, page, limit, filter: filterType } = parsed.success
    ? parsed.data
    : { query: undefined, filter: "all" as const, page: 1, limit: 25 };

  const filter: Record<string, unknown> = { isActive: true };

  if (filterType === "regular") {
    filter.walletEnabled = false;
  } else if (filterType === "wallet") {
    filter.walletEnabled = true;
  } else if (filterType === "members") {
    filter.walletEnabled = true;
    filter.cardId = { $nin: ["", null] };
  } else if (filterType === "students") {
    filter.isStudent = true;
  }

  if (query?.trim()) {
    const term = query.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { cardId: { $regex: term, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);

  return {
    items: customers.map((c) => toCustomerDTO(c)),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
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
    name: formData.get("name"),
    phone: formData.get("phone"),
    isStudent: formData.get("isStudent"),
  };

  const parsed = createCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const phone = parsed.data.phone.trim();

  const existing = await Customer.findOne({ phone });
  if (existing) {
    return failure("A customer with this phone number already exists");
  }

  try {
    const cardId = await generateCardId();

    const customer = await Customer.create({
      cardId,
      name: parsed.data.name.trim(),
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
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const name = parsed.data.name.trim();
  const phone = parsed.data.phone.trim();

  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  if (customer.name === name && customer.phone === phone) {
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

  const changes: { field: "name" | "phone"; from: string; to: string }[] = [];

  if (customer.name !== name) {
    changes.push({ field: "name", from: customer.name, to: name });
  }

  if (customer.phone !== phone) {
    changes.push({ field: "phone", from: customer.phone, to: phone });
  }

  customer.name = name;
  customer.phone = phone;
  customer.detailChanges.push({
    changedAt: new Date(),
    changedBy: authResult.session.user.username,
    changes,
  });
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
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const phone = parsed.data.phone.trim();

  if (phone) {
    const existing = await Customer.findOne({ phone });
    if (existing) {
      return failure("A customer with this phone number already exists");
    }
  }

  let customer;
  try {
    customer = await Customer.create({
      name: parsed.data.name.trim(),
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
