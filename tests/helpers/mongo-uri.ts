/** Derive an isolated e2e database URI from the project's MONGODB_URI. */
export function toE2eMongoUri(uri: string): string {
  const cleaned = uri.trim().replace(/^["']|["']$/g, "");
  const match = cleaned.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^/?]+)(.*)$/i);
  if (!match) {
    throw new Error(
      `Cannot derive e2e Mongo URI from MONGODB_URI. Got: ${cleaned.slice(0, 48)}…`
    );
  }
  return `${match[1]}/corner-pockets-e2e${match[3] ?? ""}`;
}
