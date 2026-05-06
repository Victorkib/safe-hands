# Safe Hands Escrow Implementation Plan (Verified Baseline)

## 1) Verification Summary

This plan is based on direct verification of the current codebase and supersedes assumptions.

### Confirmed Working Baseline
- Create transaction UI and API are present:
  - `app/dashboard/transactions/create/page.js`
  - `app/api/transactions/route.js`
- Payment initiation and callback flow are present:
  - `app/api/transactions/[id]/pay/route.js`
  - `app/api/mpesa/callback/route.js`
- Shipping and buyer confirmation endpoints are present:
  - `app/api/transactions/[id]/ship/route.js`
  - `app/api/transactions/[id]/confirm-delivery/route.js`
- Core transaction schema and auto-release cron are present:
  - `scripts/001_create_schema.sql`
  - `scripts/005_auto_release_cron.sql`

### Confirmed Critical Gaps / Risks
1. **Shipping UI hard bug**
   - `app/dashboard/transactions/[id]/page.js` sends `tracking_number` but state is `trackingNumber`.
   - This will throw at runtime in `markAsShipped`.
2. **Mixed auth contract across transaction APIs**
   - `app/api/transactions/route.js` uses `getServerSupabase(request)` cookie auth.
   - `pay/ship/confirm-delivery` use Bearer token parsing.
3. **Payment state machine allows premature escrow status**
   - `pay` sets transaction status to `escrow` immediately after STK initiation.
   - Callback also sets `escrow` on success.
4. **No seller approval gate before payment**
   - Flow starts at `initiated` and buyer can pay immediately.
5. **No external seller onboarding**
   - Create flow returns `Seller not found` for unknown seller email.
6. **Operational payout/refund still incomplete**
   - TODOs for B2C payout/refund exist in delivery and dispute resolution flows.

---

## 2) Delivery Strategy

Execution order:
1. **P0 Stabilization** (fix correctness before new features)
2. **Phase 1** Seller approval gate (must-have foundation)
3. **Phase 2** Seller invitation/onboarding
4. **Phase 3** Delivery evidence structure
5. **Phase 4** Notifications completion
6. **Phase 5** Dispute window UX
7. **Phase 6** End-to-end and regression testing

Definition of done for each phase:
- API contract documented and consistent
- DB migration applied and reversible
- UI reflects state machine transitions
- Smoke tests pass for changed flow
- No new lint errors in changed files

---

## 3) P0 Stabilization (Week 0)

## Goal
Make current create -> pay -> ship -> confirm flow reliable and safe.

### P0-1 Fix shipping payload bug
**Files**
- `app/dashboard/transactions/[id]/page.js`

**Changes**
- In `markAsShipped`, send `tracking_number: trackingNumber`.
- Add guard to avoid empty-string/undefined payload ambiguity.

**Acceptance**
- Seller can mark shipped without client-side ReferenceError.

### P0-2 Unify auth approach for transaction APIs
**Files**
- `app/api/transactions/[id]/pay/route.js`
- `app/api/transactions/[id]/ship/route.js`
- `app/api/transactions/[id]/confirm-delivery/route.js`
- (optional shared helper) `lib/getServerSupabase.js`

**Changes**
- Standardize to one auth approach (recommended: cookie-aware `getServerSupabase(request)` plus optional Bearer fallback helper).
- Return consistent 401 error shape.

**Acceptance**
- Same user session works consistently across create/pay/ship/confirm routes.

### P0-3 Correct payment state machine
**Files**
- `app/api/transactions/[id]/pay/route.js`
- `app/api/mpesa/callback/route.js`
- DB migration in `scripts/` (new file)

**Changes**
- Add status `payment_pending` in transaction status check constraint.
- `pay` route sets `payment_pending` on STK initiation (not `escrow`).
- Only callback/payment-status confirmation moves to `escrow`.
- History reasons updated accordingly.

**Acceptance**
- Transaction cannot be shipped while payment is still pending.

### P0-4 Harden callback idempotency and reference handling
**Files**
- `app/api/mpesa/callback/route.js`

**Changes**
- Do not overwrite `mpesa_ref` from Checkout ID with receipt value in same field.
- Store receipt in dedicated column (migration: add `mpesa_receipt_number`) or separate metadata column.
- Make callback updates conditional and idempotent (`where payment_confirmed_at is null`).
- Keep duplicate callback safe and side-effect free.

**Acceptance**
- Replayed callback does not duplicate notifications/history or corrupt payment reference.

### P0-5 Add transaction smoke test checklist
**Files**
- `TESTING_GUIDE.md`

**Changes**
- Add dedicated test suite for:
  - create transaction
  - initiate pay
  - callback success/failure
  - seller ship
  - buyer confirm delivery

**Acceptance**
- Manual QA can validate full happy path in <20 minutes.

---

## 4) Phase 1 - Seller Approval Gate (Highest ROI)

## Goal
Prevent buyer payment before explicit seller agreement.

### Database
**Migration script**
- `scripts/00x_add_seller_approval_flow.sql`

**Changes**
- Add statuses:
  - `pending_seller_approval`
  - `seller_approved`
  - `seller_rejected` (optional terminal)
  - `seller_change_requested` (optional loop state)
- Add table `seller_transaction_requests`:
  - `transaction_id`, `seller_id`, `buyer_id`
  - `status` (`pending|approved|rejected|change_requested`)
  - `seller_message`, `proposed_amount`, timestamps

### API
**Files**
- `app/api/transactions/route.js`
- `app/api/transactions/[id]/approve/route.js` (new)
- `app/api/transactions/[id]/reject/route.js` (new)
- `app/api/transactions/[id]/request-changes/route.js` (new)
- `app/api/transactions/[id]/pay/route.js`

**Changes**
- On create: set transaction to `pending_seller_approval` and create seller request row.
- Seller endpoints update both request + transaction state.
- Pay endpoint allows payment only when status is `seller_approved`.

### UI
**Files**
- `app/dashboard/transactions/[id]/page.js`
- `app/dashboard/seller/page.js` (pending approvals section)
- optional buyer transaction list detail components

**Changes**
- Seller sees Approve / Reject / Request Changes controls.
- Buyer sees “Awaiting seller approval” and no pay button until approved.
- Clear next-action status badges for both parties.

**Acceptance**
- Buyer cannot initiate payment until seller approval is recorded.

---

## 5) Phase 2 - External Seller Invitation/Onboarding

## Goal
Allow transactions with sellers not yet registered.

### Database
- Add `seller_invitations` table:
  - `email`, `invited_by_user_id`, `token_hash`, `expires_at`, `status`
  - optional linked `transaction_id`

### API
**Files**
- `app/api/transactions/route.js`
- `app/api/seller-invitations/route.js` (new)
- `app/api/seller-invitations/accept/route.js` (new)

**Changes**
- If seller email not found:
  - create invitation + pending transaction shell
  - notify buyer invitation sent
- On seller signup with valid token:
  - create/link user
  - attach seller to transaction
  - move to `pending_seller_approval`

### UI
**Files**
- `app/dashboard/transactions/create/page.js`
- `app/auth/...` invitation-aware signup pages

**Acceptance**
- Buyer can initiate transaction with non-registered seller email.

---

## 6) Phase 3 - Structured Delivery Evidence

## Goal
Upgrade from free-text proof to structured evidence for dispute clarity.

### Database
- Add `delivery_evidence` table with role-scoped entries:
  - `transaction_id`, `submitted_by`, `submission_type` (`seller_ship`, `buyer_receive`)
  - `tracking_number`, `courier`, `notes`, `photos[]`, `submitted_at`
- Keep normalized records instead of overloading `transactions` fields.

### API
**Files**
- `app/api/transactions/[id]/ship/route.js`
- `app/api/transactions/[id]/confirm-delivery/route.js`
- `app/api/transactions/[id]/evidence/route.js` (new)

**Changes**
- Ship endpoint requires structured seller shipment evidence.
- Confirm delivery captures buyer checklist + optional images.
- Expose evidence timeline endpoint for disputes/admin review.

### UI
**Files**
- `app/dashboard/transactions/[id]/page.js`

**Acceptance**
- Transaction detail shows complete seller/buyer evidence timeline.

---

## 7) Phase 4 - Notification Coverage

## Goal
Ensure all critical state transitions notify the right actor.

### Events to add
- Seller approval requested
- Seller approved/rejected/requested changes
- Payment pending/success/failure
- Item shipped
- Buyer confirmation pending
- Dispute window started
- Auto-release warning (24h)
- Auto-release executed

**Files**
- Relevant route files under `app/api/transactions/**`
- `app/api/mpesa/callback/route.js`
- `scripts/005_auto_release_cron.sql` (or app-level scheduler integration)

**Acceptance**
- Every status transition has notification parity for affected users.

---

## 8) Phase 5 - Dispute Window UX

## Goal
Make post-delivery dispute period explicit and understandable.

### UI
**Files**
- `app/dashboard/transactions/[id]/page.js`

**Changes**
- Countdown to `auto_release_date`
- “Raise dispute before deadline” callout
- Warning at 24h remaining

**Acceptance**
- Buyer can clearly see remaining dispute time; seller sees pending release timeline.

---

## 9) Phase 6 - Test & Regression Program

## Goal
Prevent regressions as state machine complexity increases.

### Add test suites
- API integration tests for transaction state transitions
- Callback replay/idempotency tests
- Role permission tests (buyer/seller/admin)
- End-to-end manual scripts in `TESTING_GUIDE.md`

### Minimum scenario matrix
1. Happy path: create -> approve -> pay -> callback -> ship -> confirm -> release
2. Seller rejects before payment
3. Payment failure/cancel
4. Callback replay
5. Dispute before auto-release
6. Auto-release without dispute

---

## 10) Suggested Backlog Slices (Review-Friendly)

1. **PR-1 (P0 bugfix + auth consistency)**
2. **PR-2 (payment_pending state + callback hardening)**
3. **PR-3 (Phase 1 schema + seller approval APIs)**
4. **PR-4 (Phase 1 UI gating)**
5. **PR-5 (seller invitations)**
6. **PR-6 (structured evidence + notifications + test expansion)**

Each PR should include:
- migration + rollback note
- API changes
- UI changes (if any)
- testing checklist updates

---

## 11) Immediate Next Action

Start with **PR-1 + PR-2** before feature expansion:
- Fix `trackingNumber` bug.
- Normalize auth handling.
- Introduce `payment_pending`.
- Harden callback idempotency/reference fields.

This creates a stable foundation for Phase 1 seller approval gating.
