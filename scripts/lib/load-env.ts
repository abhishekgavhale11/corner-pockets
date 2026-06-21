import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Load env files from project root (process.cwd()).
 * .env.local overrides .env and any pre-existing shell variables.
 */
export function loadEnv() {
  const root = process.cwd();
  const envFile = resolve(root, ".env");
  const envLocal = resolve(root, ".env.local");

  if (existsSync(envFile)) {
    config({ path: envFile });
  }

  if (existsSync(envLocal)) {
    config({ path: envLocal, override: true });
  }
}

/** Runs immediately when this module is imported — must be first import in scripts. */
loadEnv();

export function getLoadedEnvFiles(): string[] {
  const root = process.cwd();
  const files: string[] = [];
  if (existsSync(resolve(root, ".env"))) files.push(".env");
  if (existsSync(resolve(root, ".env.local"))) files.push(".env.local");
  return files;
}
