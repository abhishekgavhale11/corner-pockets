export function checkoutHrefForSession(sessionId: string): string {
  return `/checkout?session=${encodeURIComponent(sessionId)}`;
}

export function parseCheckoutSessionId(
  params: Record<string, string | string[] | undefined>
): string | undefined {
  const value = params.session;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}
