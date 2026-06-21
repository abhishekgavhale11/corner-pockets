export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDefaultStaff } = await import("@/lib/auth/ensure-default-staff");

    try {
      await ensureDefaultStaff();
    } catch (error) {
      console.error("[corner-pockets] Failed to ensure default staff:", error);
    }
  }
}
