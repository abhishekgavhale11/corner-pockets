import "./register-paths";
import { config as loadDotenv } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

let loaded = false;

/** Load auth secrets + prefer in-memory Mongo URI written by e2e-stack. */
export function ensureTestEnv(): void {
  if (loaded) {
    // Re-read URI file in case stack started after first import.
    const uriFile = resolve(process.cwd(), "tests/.mongo-uri");
    if (existsSync(uriFile)) {
      const uri = readFileSync(uriFile, "utf8").trim();
      if (uri) process.env.MONGODB_URI = uri;
    }
    return;
  }

  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) {
    loadDotenv({ path: envLocal, override: true });
  }

  const uriFile = resolve(process.cwd(), "tests/.mongo-uri");
  if (existsSync(uriFile)) {
    const uri = readFileSync(uriFile, "utf8").trim();
    if (uri) process.env.MONGODB_URI = uri;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI missing. Start tests via Playwright so tests/e2e-stack.mjs can provide an in-memory Mongo URI."
    );
  }

  process.env.AUTH_TRUST_HOST = "true";
  loaded = true;
}
