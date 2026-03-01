---
wave: 3
depends_on: []
files_modified:
  - api/generate-jewelry.ts
autonomous: true
requirements:
  - SEC-03
---

# Plan 03: Atomic Credit Deduction + Job Insert with Refund on Failure

## Goal

Credits are currently deducted before the job record is created. If the `processing_jobs` insert fails, the handler throws and the outer catch returns a 500 — but credits were already committed. The user loses credits with no generation and no refund. This plan adds a compensating refund in the catch block so that credits are always returned on any failure after deduction.

## Context

**File:** `api/generate-jewelry.ts`

The critical sequence (lines ~2217–2309):

```
line 2217: const creditsNeeded = 10;
line 2220: if (!isAdminUser) { deduct_credits RPC }   ← credits gone here
line 2238: insert into images table                    ← if this fails → throw → 500, no refund
line 2258: insert into processing_jobs table           ← if this fails → throw → 500, no refund
line 2273: if (jobError) throw jobError;
...
line 2304: } catch (error) {
line 2307:   return sendCorsResponse(res, 500, { error: errorMessage });  ← no refund
           }
```

The ideal fix is a true database transaction wrapping `deduct_credits + insert images + insert processing_jobs`, but the Supabase JS client does not support multi-statement transactions directly from the serverless runtime without a custom RPC. The practical fix is to add a compensating refund call in the catch block whenever credits may have been deducted.

**Pattern to implement:**

Track whether credits were deducted with a boolean flag. In the catch block, if the flag is true (and user is not admin), call `refund_credits` before returning the 500.

The `refund_credits` RPC already exists (used in `check-video-status.ts` via the `refundCredits` helper function). Add a similar local helper or inline the call.

## Tasks

<tasks>
  <task id="03-A">
    <title>Add credit-deducted flag and compensating refund in the catch block</title>
    <file>api/generate-jewelry.ts</file>
    <description>
      The handler's main try/catch spans lines ~2135–2309. Make the following changes:

      **Step 1: Declare a tracking variable before the try block.**

      Find the line just before `try {` that opens the main handler try block (around line 2135, after the early returns for OPTIONS and auth). Add:
      ```typescript
      let creditsDeducted = false;
      ```

      **Step 2: Set the flag after successful credit deduction.**

      Locate the credit deduction block at lines ~2220–2234:
      ```typescript
      if (!isAdminUser) {
        const { data: deductResult, error: deductError } = await supabase
          .rpc('deduct_credits', { _user_id: userId, _amount: creditsNeeded });

        if (deductError) {
          return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu.' });
        }

        if (!deductResult?.success) {
          return sendCorsResponse(res, 402, {
            error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.`
          });
        }

        console.log(`Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
      }
      ```

      After the closing `}` of the `if (!deductResult?.success)` block (i.e., after the `console.log` line), add:
      ```typescript
      creditsDeducted = !isAdminUser;
      ```

      Full updated block:
      ```typescript
      if (!isAdminUser) {
        const { data: deductResult, error: deductError } = await supabase
          .rpc('deduct_credits', { _user_id: userId, _amount: creditsNeeded });

        if (deductError) {
          return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu.' });
        }

        if (!deductResult?.success) {
          return sendCorsResponse(res, 402, {
            error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.`
          });
        }

        console.log(`Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
        creditsDeducted = true;
      }
      ```

      **Step 3: Add refund in the catch block.**

      Locate the catch block at lines ~2304–2308:
      ```typescript
      } catch (error) {
        console.error('Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        return sendCorsResponse(res, 500, { error: errorMessage });
      }
      ```

      Replace with:
      ```typescript
      } catch (error) {
        console.error('Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

        // Refund credits if they were deducted before the failure
        if (creditsDeducted) {
          console.log(`Handler failed after credit deduction — refunding ${creditsNeeded} credits to user ${userId}`);
          const { error: refundError } = await supabase.rpc('refund_credits', {
            _user_id: userId,
            _amount: creditsNeeded,
          });
          if (refundError) {
            console.error('CRITICAL: Failed to refund credits after handler error:', refundError);
          } else {
            console.log('Credits refunded successfully after handler failure');
          }
        }

        return sendCorsResponse(res, 500, { error: errorMessage });
      }
      ```

      **Important:** `userId` and `creditsNeeded` must be accessible in the catch block scope. `userId` is assigned from the `authenticateUser` result (which is already at the top of the handler, before the try block in other endpoints — but in generate-jewelry.ts, confirm the auth call placement). `creditsNeeded` is declared inside the try block at line 2217, so it needs to be hoisted.

      **Step 4: Hoist `creditsNeeded` and `userId` declarations above the try block if needed.**

      Check where `userId` is assigned. In `generate-jewelry.ts`, the auth pattern is:
      ```typescript
      const authResult = await authenticateUser(req);
      if ('error' in authResult) { return ... }
      const { userId } = authResult;
      ```

      If `userId` is declared inside the try block (using `const`), it won't be accessible in catch. Move the declaration outside:

      Before the `try {` that opens the main logic:
      ```typescript
      let userId = '';          // empty string satisfies TS definite-assignment check; always overwritten before use
      let creditsNeeded = 0;
      let creditsDeducted = false;
      ```

      Then inside the try block, use assignment instead of declaration:
      ```typescript
      // Auth (already inside try in generate-jewelry.ts)
      const authResult = await authenticateUser(req);
      if ('error' in authResult) {
        return sendCorsResponse(res, authResult.status, { error: authResult.error });
      }
      userId = authResult.userId;
      ```

      And change:
      ```typescript
      const creditsNeeded = 10;
      ```
      to:
      ```typescript
      creditsNeeded = 10;
      ```

      **Verify the exact handler structure** before making these changes by reading lines 2117–2145 to confirm where `try {` starts and where auth/userId is assigned relative to it.
    </description>
  </task>
</tasks>

## Verification

```bash
# 1. Confirm creditsDeducted flag exists
grep -n "creditsDeducted" api/generate-jewelry.ts
# Expected: declaration line + assignment after deduct + if check in catch

# 2. Confirm refund_credits call exists in catch block
grep -n "refund_credits" api/generate-jewelry.ts
# Expected: at least one occurrence in the catch block

# 3. TypeScript compiles cleanly (no scope errors)
npx tsc --noEmit

# Manual test scenario (requires test environment):
# - Trigger generate-jewelry with valid auth + enough credits
# - Simulate processing_jobs insert failure (temporarily rename table in test DB)
# - Confirm credits are returned to the user profile
```

## must_haves

- A `creditsDeducted` boolean is declared in handler scope (accessible from catch)
- `creditsDeducted = true` is set after the `deduct_credits` RPC succeeds
- The catch block calls `supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded })` when `creditsDeducted === true`
- Refund failure is logged as CRITICAL but does not suppress the original error response
- TypeScript compiles without errors (`npx tsc --noEmit`)
- `creditsNeeded` and `userId` are accessible in the catch block scope (either declared outside try or the catch can access them through closure — verify JavaScript scoping rules apply)
