# Safe Hands Escrow - Testing Guide

This document provides comprehensive testing checklists for the Safe Hands Escrow platform. Use these scenarios to validate functionality after deployments or code changes.

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Happy Path Scenarios](#happy-path-scenarios)
3. [Seller Approval Flow](#seller-approval-flow)
4. [Payment Flow](#payment-flow)
5. [Delivery & Evidence Flow](#delivery--evidence-flow)
6. [Dispute Flow](#dispute-flow)
7. [Auto-Release Flow](#auto-release-flow)
8. [External Seller Invitation](#external-seller-invitation)
9. [Notification Verification](#notification-verification)
10. [Edge Cases & Error Handling](#edge-cases--error-handling)
11. [Regression Checklist](#regression-checklist)

---

## Pre-Testing Setup

### Required Test Accounts

| Role | Email | Purpose |
|------|-------|---------|
| Buyer | buyer@test.com | Primary buyer account |
| Seller | seller@test.com | Primary seller account |
| Admin | admin@test.com | Admin operations |
| New User | newuser@test.com | Invitation flow testing |

### Database Migrations

Ensure all migrations are applied in order:

```bash
# Run migrations
node scripts/migrate.js

# Migration order:
# 1. 001_create_schema.sql
# 2. 002_add_auth_tokens.sql
# 3. 003_update_users_schema.sql
# 4. 004_fix_rls_policies.sql
# 5. 005_auto_release_cron.sql
# 6. 006_create_listings_tables.sql
# 7. 010_make_bucket_public.sql
# 8. 011_payment_pending_and_mpesa_receipt.sql
# 9. 012_add_seller_approval_flow.sql
# 10. 013_add_seller_invitations.sql
# 11. 014_add_delivery_evidence.sql
```

---

## Happy Path Scenarios

### Scenario 1: Complete Transaction (Full Happy Path)

**Estimated Time: 15-20 minutes**

| Step | Actor | Action | Expected Result |
|------|-------|--------|-----------------|
| 1 | Buyer | Log in | Dashboard loads |
| 2 | Buyer | Create transaction (KES 5,000) | Transaction created with status `pending_seller_approval` |
| 3 | Seller | Receive notification | "Transaction Approval Needed" notification appears |
| 4 | Seller | View transaction | Can see Approve/Reject/Request Changes options |
| 5 | Seller | Approve transaction | Status changes to `seller_approved` |
| 6 | Buyer | Receive notification | "Seller Approved Transaction" notification appears |
| 7 | Buyer | Initiate M-Pesa payment | STK push sent, status changes to `payment_pending` |
| 8 | System | M-Pesa callback (success) | Status changes to `escrow` |
| 9 | Seller | Receive notification | "Payment Received" notification appears |
| 10 | Seller | Mark as shipped (with tracking) | Status changes to `delivered`, evidence created |
| 11 | Buyer | Receive notification | "Item Shipped" notification appears |
| 12 | Buyer | View dispute window countdown | Timer shows ~72 hours |
| 13 | Buyer | Confirm delivery (5 stars) | Status changes to `released`, evidence created |
| 14 | Seller | Receive notification | "Funds Released" notification appears |
| 15 | Both | View evidence timeline | Both shipping and delivery evidence visible |

**Pass Criteria:**
- [ ] All status transitions correct
- [ ] All notifications received
- [ ] Evidence timeline complete
- [ ] Transaction history accurate

---

## Seller Approval Flow

### Scenario 2: Seller Approves

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create transaction | Status: `pending_seller_approval` |
| 2 | Seller approves | Status: `seller_approved` |
| 3 | Buyer can pay | Payment button visible |

### Scenario 3: Seller Rejects

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create transaction | Status: `pending_seller_approval` |
| 2 | Seller rejects (with message) | Status: `seller_rejected` |
| 3 | Buyer sees rejection | Rejection message visible, no payment option |

### Scenario 4: Seller Requests Changes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create transaction (KES 5,000) | Status: `pending_seller_approval` |
| 2 | Seller requests changes (KES 6,000) | Status: `seller_change_requested` |
| 3 | Buyer sees change request | Proposed amount visible |
| 4 | Buyer accepts changes | Status: `seller_approved`, amount updated to KES 6,000 |
| 5 | Buyer can pay | Payment shows KES 6,000 |

**Pass Criteria:**
- [ ] Approval required before payment
- [ ] Rejection terminates flow
- [ ] Change requests update amount
- [ ] All notifications sent

---

## Payment Flow

### Scenario 5: Payment Success

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Initiate payment | STK push sent |
| 2 | Status immediately | `payment_pending` |
| 3 | Callback success | Status: `escrow` |
| 4 | Receipt stored | `mpesa_receipt_number` populated |
| 5 | Notifications | Buyer & seller notified |

### Scenario 6: Payment Failure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Initiate payment | STK push sent |
| 2 | User cancels/fails | Callback with failure |
| 3 | Status reverts | Back to `seller_approved` |
| 4 | Buyer notified | "Payment Failed" notification |
| 5 | Can retry | Payment button still available |

### Scenario 7: Callback Idempotency

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Process first callback | Status: `escrow` |
| 2 | Replay same callback | No change, no duplicate notifications |
| 3 | Check history | Single entry for payment |

**Pass Criteria:**
- [ ] `payment_pending` status used during STK
- [ ] Successful callback moves to `escrow`
- [ ] Failed callback reverts properly
- [ ] Duplicate callbacks are safe

---

## Delivery & Evidence Flow

### Scenario 8: Shipping with Evidence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seller clicks "Mark as Shipped" | Modal opens |
| 2 | Enter tracking number | e.g., "TRK123456" |
| 3 | Select courier | e.g., "G4S Kenya" |
| 4 | Add shipping notes | e.g., "Packaged securely" |
| 5 | Submit | Status: `delivered` |
| 6 | Check transaction | `tracking_number`, `courier`, `shipped_at` populated |
| 7 | Check evidence | `seller_ship` evidence record created |
| 8 | Buyer notification | "Item Shipped" with tracking info |

### Scenario 9: Delivery Confirmation with Evidence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Buyer clicks "Confirm Delivery" | Modal opens |
| 2 | Rate condition | 5 stars |
| 3 | Check "Item matches description" | Checkbox selected |
| 4 | Add comment | e.g., "Great condition!" |
| 5 | Submit | Status: `released` |
| 6 | Check evidence | `buyer_receive` evidence record created |
| 7 | Evidence timeline | Shows both seller and buyer evidence |

### Scenario 10: Evidence Timeline Display

| Check | Expected |
|-------|----------|
| Shipping evidence | Blue border, seller name, tracking |
| Delivery evidence | Green border, buyer name, rating |
| Chronological order | Earliest first |
| Photo links | Clickable if present |

**Pass Criteria:**
- [ ] Structured evidence saved
- [ ] Timeline displays correctly
- [ ] Both parties can view evidence
- [ ] Evidence persists after release

---

## Dispute Flow

### Scenario 11: Buyer Raises Dispute

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Transaction in `delivered` status | Dispute button visible |
| 2 | Click "Raise Dispute" | Modal opens |
| 3 | Select reason | e.g., "Item not as described" |
| 4 | Enter description | Detailed issue |
| 5 | Submit | Status: `disputed` |
| 6 | Seller notified | "Dispute Raised Against You" |
| 7 | Admin notified | "New Dispute Requires Review" |

### Scenario 12: Admin Resolves Dispute

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin views dispute | Full details visible |
| 2 | Review evidence | All evidence accessible |
| 3 | Resolve (refund buyer) | Dispute status: `resolved` |
| 4 | Transaction updated | Based on resolution |
| 5 | Both parties notified | "Dispute Resolved" |

**Pass Criteria:**
- [ ] Dispute blocks auto-release
- [ ] Evidence available to admin
- [ ] Resolution updates transaction
- [ ] Notifications sent to all parties

---

## Auto-Release Flow

### Scenario 13: Auto-Release After 3 Days

| Step | Time | Expected |
|------|------|----------|
| 1 | T+0 | Seller ships, `auto_release_date` set to T+3 days |
| 2 | T+47h | Warning notifications sent |
| 3 | T+71h | Countdown shows <24h (orange) |
| 4 | T+72h | Status: `released` automatically |
| 5 | Post-release | Both parties notified |

### Scenario 14: Dispute Blocks Auto-Release

| Step | Action | Expected |
|------|--------|----------|
| 1 | T+0 | Seller ships |
| 2 | T+48h | Buyer raises dispute |
| 3 | T+72h | Auto-release NOT triggered |
| 4 | After resolution | Funds released per resolution |

### Scenario 15: Countdown Display

| Time Remaining | UI State |
|----------------|----------|
| > 24h | Blue theme, normal |
| < 24h | Orange theme, "Closing in 24h" |
| < 6h | Red theme, "URGENT", pulsing button |
| Expired | Gray, "Expired" message |

**Pass Criteria:**
- [ ] Auto-release at correct time
- [ ] Disputes block auto-release
- [ ] Warning notifications at 24h
- [ ] Countdown UI correct at all stages

---

## External Seller Invitation

### Scenario 16: Invite New Seller

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Buyer creates transaction | Uses unregistered seller email |
| 2 | System response | 202 status, invitation created |
| 3 | Email sent | Invitation email to seller |
| 4 | Seller clicks link | Signup page with invite token |
| 5 | Seller completes signup | Account created, linked to invitation |
| 6 | Transaction created | Status: `pending_seller_approval` |
| 7 | Seller can approve | Normal approval flow |

**Pass Criteria:**
- [ ] Invitation created for unknown email
- [ ] Email contains correct link
- [ ] Signup accepts invite token
- [ ] Transaction created on acceptance

---

## Notification Verification

### Notification Coverage Matrix

| Event | Buyer | Seller | Admin |
|-------|-------|--------|-------|
| Transaction created | - | Yes | - |
| Seller approves | Yes | - | - |
| Seller rejects | Yes | - | - |
| Seller requests changes | Yes | - | - |
| Buyer accepts changes | - | Yes | - |
| Payment initiated | - | Yes | - |
| Payment successful | Yes | Yes | - |
| Payment failed | Yes | - | - |
| Item shipped | Yes | - | - |
| Delivery confirmed | Yes | Yes | - |
| Funds released | Yes | Yes | - |
| Dispute raised | Yes | Yes | Yes |
| Dispute resolved | Yes | Yes | - |
| Auto-release warning (24h) | Yes | Yes | - |
| Auto-release executed | Yes | Yes | - |

**Pass Criteria:**
- [ ] All notifications delivered
- [ ] Critical events send email
- [ ] In-app notifications appear in dashboard
- [ ] Notifications link to correct transaction

---

## Edge Cases & Error Handling

### Edge Case Tests

| Case | Test | Expected |
|------|------|----------|
| Self-transaction | Buyer = Seller | Error: "Cannot create transaction with yourself" |
| Double payment | Pay twice | Second attempt blocked |
| Ship wrong status | Ship before escrow | Error: "Cannot ship..." |
| Confirm wrong status | Confirm before delivered | Error: "Cannot confirm..." |
| Duplicate callback | Replay M-Pesa callback | No duplicate action |
| Expired invite | Use old invite token | Error: "Invitation expired" |
| Invalid seller role | Buyer tries to approve | Error: 403 Forbidden |

### Permission Tests

| Action | Buyer | Seller | Admin |
|--------|-------|--------|-------|
| Create transaction | Yes | No | No |
| Approve transaction | No | Yes | No |
| Initiate payment | Yes | No | No |
| Mark shipped | No | Yes | No |
| Confirm delivery | Yes | No | No |
| Raise dispute | Yes | Yes | No |
| Resolve dispute | No | No | Yes |

**Pass Criteria:**
- [ ] All edge cases handled gracefully
- [ ] Permission boundaries enforced
- [ ] Error messages are user-friendly

---

## Regression Checklist

Run this checklist before every deployment:

### Core Flow
- [ ] User can register and verify email
- [ ] User can log in
- [ ] Buyer can create transaction
- [ ] Seller approval flow works
- [ ] M-Pesa payment initiates
- [ ] Callback processes correctly
- [ ] Seller can ship
- [ ] Buyer can confirm delivery
- [ ] Funds release correctly

### Evidence System
- [ ] Evidence saves on ship
- [ ] Evidence saves on confirm
- [ ] Evidence timeline displays
- [ ] Additional evidence can be added

### Notifications
- [ ] In-app notifications appear
- [ ] Email notifications send (critical events)
- [ ] Notification links work

### Dispute System
- [ ] Dispute can be raised
- [ ] Dispute blocks auto-release
- [ ] Admin can view disputes
- [ ] Resolution works

### Auto-Release
- [ ] Countdown displays correctly
- [ ] Warning notifications at 24h
- [ ] Auto-release triggers at 72h
- [ ] Disputes prevent auto-release

### UI/UX
- [ ] All modals open/close correctly
- [ ] Loading states display
- [ ] Error messages are clear
- [ ] Mobile responsive

---

## Test Data Cleanup

After testing, clean up test data:

```sql
-- Delete test transactions (replace with actual IDs)
DELETE FROM transactions WHERE buyer_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.com'
);

-- Or use truncate for full reset (CAUTION: removes all data)
-- TRUNCATE transactions, disputes, notifications, delivery_evidence CASCADE;
```

---

## Reporting Issues

When reporting bugs:

1. **Environment**: Production/Staging/Local
2. **Steps to reproduce**: Numbered list
3. **Expected behavior**: What should happen
4. **Actual behavior**: What happened
5. **Screenshots/Logs**: Console errors, network failures
6. **User context**: Role, browser, device

---

*Last Updated: Phase 6 Implementation*
*Document Version: 1.0*
