export function normalizeMongoUri(
  uri: string | undefined
): string | undefined {
  if (!uri) return undefined;

  const cleaned = uri
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");

  return cleaned || undefined;
}
