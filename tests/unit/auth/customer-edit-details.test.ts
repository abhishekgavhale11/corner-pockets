import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/roles";

describe("CUSTOMER_EDIT_DETAILS", () => {
  it("allows Admin and Staff to edit customer name and details", () => {
    expect(hasPermission("SUPER_MASTER", "CUSTOMER_EDIT_DETAILS")).toBe(true);
    expect(hasPermission("MASTER", "CUSTOMER_EDIT_DETAILS")).toBe(true);
    expect(hasPermission("STAFF", "CUSTOMER_EDIT_DETAILS")).toBe(true);
  });
});
