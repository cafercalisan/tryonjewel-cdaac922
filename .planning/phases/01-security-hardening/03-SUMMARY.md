---
phase: 01
plan: 03
subsystem: api
tags: [security, credits, refund, atomicity]
requires: []
provides: [atomic-credit-refund-on-failure]
affects: [api/generate-jewelry.ts]
tech-stack:
  added: []
  patterns: [compensating-transaction]
key-files:
  created: []
  modified:
    - api/generate-jewelry.ts
key-decisions:
  - Compensating refund pattern instead of DB transaction (Supabase JS client does not support multi-statement transactions from serverless)
  - creditsDeducted flag tracks whether refund is needed; avoids refunding admin users (creditsDeducted stays false for admins)
  - Refund failure is logged as CRITICAL but does not suppress the original error response to the client
requirements-completed:
  - SEC-03
duration: 5 min
completed: 2026-03-01T14:41:43Z
---

# Phase 1 Plan 03: Atomic Credit Deduction + Job Insert with Refund on Failure Summary

Implemented a compensating refund pattern in `api/generate-jewelry.ts` so that credits deducted before a `processing_jobs` insert failure are automatically returned to the user. Previously, any throw between `deduct_credits` and a successful job record insert left the user with no credits and no generation.

**Duration:** ~5 min | **Tasks:** 1 | **Files modified:** 1

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 03-A | Add credit-deducted flag and compensating refund in catch block | `87ec3d1` |

## What Was Built

Three coordinated changes to the main handler in `api/generate-jewelry.ts`:

1. **Hoisted declarations** — `userId`, `creditsNeeded`, and `creditsDeducted` declared with `let` before the `try` block (lines 2125–2127) so they are accessible in the `catch` scope.

2. **Flag set after successful deduction** — `creditsDeducted = true` added immediately after the `console.log` confirming credit deduction (line 2239), inside the `if (!isAdminUser)` block. Admin users never set the flag, so they are never refunded.

3. **Compensating refund in catch block** — The `catch` block now calls `supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded })` when `creditsDeducted === true`. Refund failure is logged as CRITICAL but the original error response is always returned.

## Deviations from Plan

None - plan executed exactly as written.

The plan noted that `creditsDeducted = !isAdminUser` was one formulation, but also showed `creditsDeducted = true` inside the `if (!isAdminUser)` block as the "Full updated block". The latter was used — it is semantically equivalent and clearer since the assignment only runs when inside `if (!isAdminUser)`.

## Verification

```
grep -n "creditsDeducted" api/generate-jewelry.ts
2127:  let creditsDeducted = false;
2239:      creditsDeducted = true;
2314:    if (creditsDeducted) {

grep -n "refund_credits" api/generate-jewelry.ts
2317:      const { error: refundError } = await supabase.rpc('refund_credits', {

npx tsc --noEmit  → clean (no output)
```

## Next

Ready for Phase 1 Plan 04 (if not already complete) or phase transition.

## Self-Check: PASSED

- `creditsDeducted` boolean declared before try block: YES (line 2127)
- `creditsDeducted = true` after successful deduction: YES (line 2239)
- catch block calls `refund_credits` when `creditsDeducted === true`: YES (lines 2314–2326)
- `userId` and `creditsNeeded` accessible in catch: YES (hoisted to outer let scope)
- Commit references "phase-01 plan-03": YES (`87ec3d1`)
- TypeScript compiles: YES (npx tsc --noEmit, no errors)
