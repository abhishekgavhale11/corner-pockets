import { register } from "tsconfig-paths";
import { resolve } from "path";

/** Enable `@/*` imports when Playwright loads application modules from tests. */
export function registerPathAliases(): void {
  register({
    baseUrl: resolve(process.cwd()),
    paths: {
      "@/*": ["src/*"],
    },
  });
}

registerPathAliases();
