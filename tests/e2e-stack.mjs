/**
 * Starts a single-node MongoMemoryReplSet (required for transactions),
 * then Next.js on :3001 for Playwright e2e.
 * Writes the active URI to tests/.mongo-uri for test workers.
 */
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const uriFile = resolve(__dirname, ".mongo-uri");

const envLocal = resolve(root, ".env.local");
if (existsSync(envLocal)) {
  loadDotenv({ path: envLocal, override: true });
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

async function main() {
  mkdirSync(__dirname, { recursive: true });

  console.log("[e2e-stack] Starting MongoMemoryReplSet…");
  const replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
      dbName: "corner-pockets-e2e",
    },
  });
  await replSet.waitUntilRunning();
  const uri = replSet.getUri("corner-pockets-e2e");
  writeFileSync(uriFile, uri, "utf8");
  console.log("[e2e-stack] MongoMemoryReplSet ready");

  const useShell = process.platform === "win32";
  const child = spawn("npx", ["next", "dev", "-p", "3001"], {
    cwd: root,
    env: {
      ...process.env,
      MONGODB_URI: uri,
      AUTH_URL: baseURL,
      AUTH_TRUST_HOST: "true",
      PORT: "3001",
    },
    stdio: "inherit",
    shell: useShell,
  });

  const shutdown = async () => {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    try {
      await replSet.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", async (code) => {
    try {
      await replSet.stop();
    } catch {
      /* ignore */
    }
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error("[e2e-stack] failed to start", error);
  process.exit(1);
});
