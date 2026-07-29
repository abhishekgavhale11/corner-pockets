import "../../helpers/env";
import { test } from "@playwright/test";

/**
 * CPOS Wallet workflows — Scenario 7 (Wallet Recharge) & Scenario 8 (Wallet Payment).
 *
 * BLOCKED: no Wallet module exists in the current CPOS V2 application build.
 *
 * Evidence gathered before writing this file (do not re-implement without
 * re-checking these facts — the feature may still be mid-development):
 *
 * 1. `docs/00-business-rules.md` (single source of truth per repo rule
 *    `cpos-business-rules.mdc`) defines exactly two payment modes — Cash and
 *    GPay (see "9. Payment Model"). There is no mention anywhere in that
 *    document of a Wallet, Recharge, Bonus, or stored-value balance concept.
 *
 * 2. `git status` on the working tree shows every wallet-related source file
 *    as a pending deletion (`D`), e.g.:
 *      D src/lib/wallet/apply-balance-payment.ts
 *      D src/lib/wallet/execute-wallet-deduct.ts
 *      D src/lib/wallet/operational-payment.ts
 *      D src/lib/wallet/recharge-credit.ts
 *      D src/lib/wallet/wallet-payment-context.ts
 *      D src/lib/wallet/wallet-payment-math.ts
 *      D src/components/wallet/*.tsx
 *      D src/app/(dashboard)/wallet/recharge/page.tsx
 *      D src/app/(dashboard)/wallet/deduct/page.tsx
 *      D src/app/(dashboard)/customers/[id]/recharge/page.tsx
 *      D src/app/(dashboard)/customers/[id]/deduct/page.tsx
 *      D src/app/(dashboard)/customers/[id]/transactions/page.tsx
 *      D src/actions/transactions.ts
 *    None of these files exist on disk. `src/lib/wallet/` and
 *    `src/app/(dashboard)/wallet/` are empty directories.
 *
 * 3. A prior build attempt failed to compile the Wallet feature:
 *      ./src/lib/wallet/execute-wallet-deduct.ts:39:17
 *      Type error: Property 'walletEnabled' does not exist on type
 *      '... ICustomer ...'.
 *    `walletEnabled` was never added to `src/models/Customer.ts`, so the
 *    feature was never in a working state.
 *
 * 4. The current, successfully-compiling route manifest (`npm run build`)
 *    contains no `/wallet/*` route and no `/customers/[id]/recharge`,
 *    `/customers/[id]/deduct`, or `/customers/[id]/transactions` route.
 *    Sidebar/TopBar navigation has no "Wallet" entry.
 *
 * Conclusion: Scenario 7 (Wallet Recharge) and Scenario 8 (Wallet Payment)
 * cannot be implemented against the current application. They are declared
 * `test.fixme` (visible as "todo" in the Playwright report, not a silent
 * omission) so the suite explicitly documents the gap instead of hiding it.
 *
 * To unblock:
 *   - Ship the Wallet module (model field, recharge/deduct UI, payment mode)
 *     per an approved addition to docs/00-business-rules.md, then implement
 *     these two tests using the same helper/reuse conventions as
 *     `cashier-workflows.spec.ts` (uiLogin, uiStartBusinessDayIfNeeded,
 *     uiCreateCustomerFromCounter, financial-integrity DB helpers, etc.).
 */

test.describe("CPOS wallet workflows", () => {
  test.fixme(
    "Scenario 7 – Wallet Recharge credits balance (+ bonus if configured)",
    async () => {
      // BLOCKED — see file docstring. No /wallet/recharge route, no
      // recharge-credit business logic, and no bonus/plan configuration
      // exist in the current build.
      //
      // Intended coverage once implemented:
      //   - Recharge wallet for a customer via the UI.
      //   - Verify wallet balance updates on Customer Details.
      //   - Verify bonus credit is applied per the configured recharge plan
      //     (if/when a bonus plan concept is (re)introduced).
      //   - Verify MongoDB persistence of the recharge transaction.
    }
  );

  test.fixme(
    "Scenario 8 – Wallet Payment (Wallet + Cash) settles a bill to Due 0",
    async () => {
      // BLOCKED — see file docstring. No wallet balance/deduction UI or
      // "WALLET" payment method exists; NotebookEntry/CafeOrder payment
      // methods are limited to CASH and GPAY (docs/00-business-rules.md §9).
      //
      // Intended coverage once implemented:
      //   - Recharge wallet, then create a Frame/Cafe bill.
      //   - Pay using a Wallet + Cash split.
      //   - Verify wallet deduction, Cash received, and Due = 0 on Counter,
      //     Customer Details, Business Summary, and Customer Timeline.
      //   - Verify MongoDB persistence of the wallet deduction + payment.
    }
  );
});
