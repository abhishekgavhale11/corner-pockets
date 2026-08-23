import { describe, expect, it } from "vitest";
import { updateCustomerDetailsSchema } from "@/lib/validators/customer";

describe("updateCustomerDetailsSchema", () => {
  const valid = {
    customerId: "507f1f77bcf86cd799439011",
    firstName: "Ravi",
    lastName: "Kumar",
    phone: "9876543210",
    cardId: "CP0001",
  };

  it("accepts a valid name and mobile number", () => {
    const parsed = updateCustomerDetailsSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.firstName).toBe("Ravi");
      expect(parsed.data.lastName).toBe("Kumar");
      expect(parsed.data.phone).toBe("9876543210");
      expect(parsed.data.customerId).toBe(valid.customerId);
    }
  });

  it("rejects an empty name", () => {
    const parsed = updateCustomerDetailsSchema.safeParse({
      ...valid,
      firstName: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty surname", () => {
    const parsed = updateCustomerDetailsSchema.safeParse({
      ...valid,
      lastName: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a mobile number that is too short", () => {
    const parsed = updateCustomerDetailsSchema.safeParse({
      ...valid,
      phone: "12345",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid mobile number format", () => {
    const parsed = updateCustomerDetailsSchema.safeParse({
      ...valid,
      phone: "abcdefghij",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing customerId", () => {
    const parsed = updateCustomerDetailsSchema.safeParse({
      ...valid,
      customerId: "",
    });
    expect(parsed.success).toBe(false);
  });
});
