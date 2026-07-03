# Corner Pockets POS

Documentation for the Corner Pockets snooker club counter/POS system. This folder is the **single source of truth** for business rules, project status, and implementation context.

---

## Before making any changes

Read the following files **in this order**:

1. [`business-architecture.md`](./business-architecture.md) — business rules and workflows
2. [`current-status.md`](./current-status.md) — what is done, in progress, and next
3. [`known-bugs.md`](./known-bugs.md) — open and fixed bugs (never delete entries)
4. [`testing-checklist.md`](./testing-checklist.md) — scenarios to verify, including regressions

For implementation details, see [`technical-architecture.md`](./technical-architecture.md).

---

## After completing work

1. Update [`current-status.md`](./current-status.md)
2. Append to [`changelog.md`](./changelog.md)
3. Update [`business-architecture.md`](./business-architecture.md) if business rules changed
4. Update [`testing-checklist.md`](./testing-checklist.md) if a new scenario exists (add a regression test when fixing bugs)

---

## Quick start (development)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Default login: `admin` / `corner123`

Legacy docs (`PROJECT-CONTEXT.md`, `business-architecture-v1.0.md`, etc.) are superseded by this folder.
