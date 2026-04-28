# PHASE 3: ESCROW & M-PESA INTEGRATION - IMPLEMENTATION PLAN

## Overview

Phase 3 builds on the solid authentication foundation (Phase 2) to implement the core escrow transaction system with M-Pesa payment integration.

**Scope:** Transaction creation → M-Pesa payment → Escrow holding → Delivery confirmation → Fund release

**Timeline:** 4 weeks (Feb-Mar)

---

## Architecture Overview

```
BUYER FLOW:
1. Login (Phase 2 ✅)
2. Create Transaction → [Phase 3]
   - Enter seller phone/email
   - Describe item
   - Set amount
   - Submit
3. M-Pesa STK Push → [Phase 3]
   - Payment prompt on buyer's phone
   - User enters M-Pesa PIN
   - Payment confirmed
4. Funds in Escrow → [Phase 3]
   - Transaction status: 'escrow'
   - Money held in escrow account
   - Buyer gets transaction ID
5. Wait for Delivery → [Phase 3]
   - Seller ships item
   - Seller marks as shipped
   - Buyer receives + confirms
6. Release Funds → [Phase 3]
   - Buyer confirms delivery
   - Funds released to seller
   - Transaction closed

SELLER FLOW:
1. Login (Phase 2 ✅)
2. View Incoming Transactions → [Phase 3]
   - Payment confirmed in escrow
   - Item details from buyer
   - Buyer rating/history
3. Mark as Shipped → [Phase 3]
   - Upload shipping proof
   - Leave shipping note
4. Complete Transaction → [Phase 3]
   - Wait for buyer confirmation
   - Funds released to account
   - Get paid

DISPUTE FLOW:
1. Buyer/Seller Raises Dispute → [Phase 3]
   - Can't resolve directly
   - Submit reason + evidence
   - Admin notified
2. Admin Reviews → [Phase 3]
   - Check evidence
   - Decide: release to seller / refund to buyer / partial
3. Resolution → [Phase 3]
   - Funds transferred per decision
   - Both parties notified
```

---

## Database Schema Ready

✅ All tables created and indexed:
- `transactions` - Core escrow data
- `transaction_history` - Audit trail
- `disputes` - Dispute management
- `notifications` - User alerts
- `ratings` - User reputation
- RLS policies configured for security

---

## Phase 3 Breakdown

### WEEK 1: M-Pesa Integration & Transaction Creation

#### Task 1.1: Test M-Pesa Credentials
- Verify M-Pesa Daraja API access
- Test authentication with consumer key/secret
- Document base URL & endpoints
- Create test endpoint: `POST /api/test/mpesa-auth`

#### Task 1.2: Create Transaction API Routes
- `POST /api/escrow/create-transaction` - Create new transaction
  - Input: seller_email/phone, amount, description, buyer_id
  - Validate: amount > 0, seller exists, buyer not same as seller
  - Create transaction record with status='initiated'
  - Return transaction_id for next step

- `GET /api/escrow/transaction/[id]` - Get transaction details
  - Return all transaction data
  - Use RLS to ensure buyer/seller/admin only

- `GET /api/escrow/my-transactions` - List user's transactions
  - Separate: created (buyer), incoming (seller)
  - Pagination support

#### Task 1.3: Create Transaction Pages
- `app/escrow/create-transaction/page.js`
  - Form: seller phone/email, amount, description
  - Real-time validation of seller existence
  - Estimated fees display
  - Submit → API → Get transaction_id → Proceed to payment

- `app/escrow/[id]/details/page.js`
  - Show all transaction info
  - Current status with timeline
  - Delivery proof images
  - Dispute info if applicable

#### Task 1.4: Update Dashboards
- Add "Create Transaction" button to buyer dashboard
- Add "Incoming Transactions" widget to seller dashboard
- Show transaction status/pending actions prominently

---

### WEEK 2: M-Pesa Payment Processing

#### Task 2.1: Implement M-Pesa STK Push
- `POST /api/mpesa/initiate-payment`
  - Input: transaction_id, phone, amount
  - Call M-Pesa Daraja API to generate STK push
  - Store in transaction: mpesa_ref, mpesa_phone
  - Return: request_id for polling

- Handle response: Success/Failure/Timeout
- Display user-friendly messages

#### Task 2.2: M-Pesa Callback Handler
- `POST /api/mpesa/callback`
  - Receive payment confirmation from M-Pesa
  - Verify signature & request ID
  - Update transaction:
    - Status: initiated → escrow
    - mpesa_ref
    - payment_confirmed_at
  - Create transaction_history record
  - Send notification to both parties

#### Task 2.3: Payment Polling Fallback
- `GET /api/mpesa/check-status/[transactionId]`
  - Query M-Pesa API for payment status
  - Update transaction if confirmed
  - For cases where callback doesn't arrive

#### Task 2.4: Create Payment Pages
- `app/escrow/[id]/payment/page.js`
  - Show amount to pay
  - Enter M-Pesa phone number
  - Initiate STK push
  - Show loading with "Please complete payment on your phone"
  - Poll for status
  - On success → "Waiting for seller to ship"

---

### WEEK 3: Delivery Workflow

#### Task 3.1: Seller Shipping Endpoints
- `POST /api/escrow/[id]/mark-shipped`
  - Input: proof_image_url, shipping_note (optional)
  - Validate: seller is actual seller, transaction is 'escrow'
  - Update transaction:
    - delivery_proof_url
    - Create history record
  - Send notification: "Seller has shipped your item"

#### Task 3.2: Buyer Delivery Confirmation
- `POST /api/escrow/[id]/confirm-delivery`
  - Input: buyer_confirmation_text (optional), rating (optional)
  - Validate: buyer is actual buyer, transaction is 'delivered'
  - Update transaction:
    - Status: delivered
    - buyer_confirmation
    - delivery_confirmed_at
  - Create history record
  - Trigger: Release funds to seller

#### Task 3.3: Auto-Release After 3 Days
- `POST /api/escrow/[id]/auto-release`
  - Background job (Vercel Cron or manual endpoint)
  - Check: auto_release_date has passed, no dispute
  - Release funds automatically
  - Send notification to seller

#### Task 3.4: Create Delivery Pages
- `app/escrow/[id]/delivery/page.js` (seller)
  - Upload shipping proof
  - Add shipping note
  - Mark as shipped button

- `app/escrow/[id]/confirm-delivery/page.js` (buyer)
  - Show item details + seller proof
  - Buyer confirms receipt
  - Option to rate seller
  - Confirm button

---

### WEEK 4: Dispute Resolution & Polish

#### Task 4.1: Dispute API Endpoints
- `POST /api/dispute/create`
  - Input: transaction_id, reason, description, evidence_urls[]
  - Validate: user involved in transaction, transaction is in correct status
  - Create dispute record with status='open'
  - Prevent auto-release
  - Notify admin & other party

- `GET /api/dispute/[id]` - Get dispute details
- `GET /api/dispute/list` - List user's disputes

#### Task 4.2: Admin Dispute Resolution
- `POST /api/admin/dispute/[id]/resolve`
  - Input: resolution (refund_buyer/release_to_seller/partial_refund), admin_notes
  - Update dispute: status='resolved', resolution, resolved_at, resolved_by
  - Transfer funds according to decision
  - Create transaction_history record
  - Send notifications to both parties
  - Close transaction

#### Task 4.3: Create Dispute Pages
- `app/escrow/[id]/dispute/page.js`
  - Form: reason dropdown, description, upload evidence
  - Submit to create dispute

- `app/admin/disputes/page.js`
  - List all open disputes
  - Show evidence
  - Decision buttons with notes field
  - History of resolutions

#### Task 4.4: Notifications System
- Create notification records for all status changes
- Send in-app notifications
- Optional: Email notifications

#### Task 4.5: Transaction Timeline
- Visual timeline showing:
  - Transaction created
  - Payment confirmed
  - Shipped
  - Delivered confirmed
  - Funds released
  - Timestamps for each

---

## Files to Create

### API Routes (14 files)
```
app/api/escrow/create-transaction/route.js
app/api/escrow/get-transaction/route.js
app/api/escrow/list-transactions/route.js
app/api/escrow/mark-shipped/route.js
app/api/escrow/confirm-delivery/route.js
app/api/escrow/auto-release/route.js

app/api/mpesa/initiate-payment/route.js
app/api/mpesa/callback/route.js
app/api/mpesa/check-status/route.js

app/api/dispute/create/route.js
app/api/dispute/get/route.js
app/api/dispute/list/route.js

app/api/admin/resolve-dispute/route.js

app/api/test/mpesa-auth/route.js (testing)
```

### Pages (8 files)
```
app/escrow/create-transaction/page.js
app/escrow/[id]/details/page.js
app/escrow/[id]/payment/page.js
app/escrow/[id]/delivery/page.js (seller)
app/escrow/[id]/confirm-delivery/page.js (buyer)
app/escrow/[id]/dispute/page.js
app/admin/disputes/page.js
app/admin/dispute/[id]/page.js
```

### Components (15 files)
```
components/escrow/CreateTransactionForm.js
components/escrow/TransactionCard.js
components/escrow/TransactionTimeline.js
components/escrow/PaymentForm.js
components/escrow/ShippingForm.js
components/escrow/DeliveryConfirmation.js
components/escrow/TransactionStatusBadge.js
components/dispute/DisputeForm.js
components/dispute/DisputeCard.js
components/dispute/DisputeTimeline.js
components/admin/DisputeReviewer.js
components/admin/DisputeResolutionForm.js
components/notifications/TransactionNotification.js
components/dashboard/TransactionWidget.js
```

### Libraries (3 files)
```
lib/escrowService.js - Transaction logic
lib/paymentService.js - M-Pesa wrapper
lib/disputeService.js - Dispute logic
```

### Updated Components (3 files)
```
components/shared/Navbar.js - Add notifications bell
app/dashboard/layout.js - Add transaction alerts
app/page.js - Update homepage with features
```

---

## M-Pesa Integration Details

### Prerequisites
- M-Pesa Daraja API credentials (Consumer Key, Secret)
- Business till number for receiving payments
- Paybill number if using business account
- Callback URL pointing to your app

### Key Endpoints
1. **Authentication**
   - POST `/oauth/v1/generate?grant_type=client_credentials`
   - Get access token (valid for 1 hour)

2. **STK Push (Initiate Payment)**
   - POST `/mpesa/stkpush/v1/processrequest`
   - Trigger payment prompt on user's phone
   - User enters PIN
   - Callback returns result

3. **Callback Verification**
   - Validate signature
   - Parse response
   - Update transaction status
   - Release to next step

### M-Pesa Flow Diagram
```
User Creates Transaction
         ↓
Call /api/mpesa/initiate-payment
         ↓
Our API calls M-Pesa Daraja
         ↓
M-Pesa sends STK prompt to buyer's phone
         ↓
Buyer enters M-Pesa PIN
         ↓
M-Pesa processes payment
         ↓
M-Pesa calls our /api/mpesa/callback
         ↓
We verify signature & update transaction
         ↓
Status changes: initiated → escrow
         ↓
Seller sees incoming transaction
```

---

## Key Decisions to Make

1. **Escrow Account:** How are funds held?
   - Option A: Safaricom Paybill (automatic)
   - Option B: Business account with manual settlement
   - Option C: Third-party escrow service

2. **Auto-Release:** After 3 days with no dispute?
   - Yes → Simple UX, automatic resolution
   - No → Requires manual release from buyer

3. **Dispute Evidence:** Should we support image uploads?
   - Yes → Use Vercel Blob
   - No → Text only

4. **Notifications:** Email or in-app only?
   - In-app first, email later
   - Include phone SMS?

5. **Admin Dashboard:** Who can resolve disputes?
   - Hardcoded list of admin emails
   - Role-based system (defer to later)

---

## Security Checklist

- ✅ M-Pesa callback signature verification
- ✅ Rate limiting on payment endpoints
- ✅ RLS policies on all transaction data
- ✅ Only buyer/seller/admin can view transactions
- ✅ Only seller can confirm shipped
- ✅ Only buyer can confirm delivered
- ✅ Only admin can resolve disputes
- ✅ Prevent duplicate payments
- ✅ Prevent tampered amounts
- ✅ Audit log all transactions
- ✅ Secure token storage (hashed)

---

## Testing Strategy

### Unit Tests
- Transaction creation validation
- M-Pesa response parsing
- Dispute logic

### Integration Tests
- Full payment flow (M-Pesa sandbox)
- Shipping workflow
- Dispute resolution

### Manual Testing
- Create transaction with test seller
- Process payment on M-Pesa sandbox
- Confirm delivery
- Rate transaction
- Raise & resolve dispute

---

## Deployment

### Pre-Production Checklist
- ✅ M-Pesa sandbox credentials set
- ✅ Database migrations applied
- ✅ RLS policies verified
- ✅ Error logging configured
- ✅ Rate limiting tested
- ✅ Callback signature verification working

### Production Checklist
- ✅ M-Pesa production credentials
- ✅ Escrow account configured
- ✅ Backup & disaster recovery
- ✅ Monitoring & alerts
- ✅ Support team trained
- ✅ Legal/compliance review

---

## Success Metrics

- Transaction creation works end-to-end
- M-Pesa payments process successfully
- <1% callback failure rate
- <10 seconds payment confirmation time
- Disputes resolved within 24 hours
- Zero unauthorized transactions

---

## Next Steps

1. Confirm M-Pesa credentials are ready
2. Decide on escrow account handling
3. Answer key decisions above
4. Start Week 1 implementation
5. Daily standups to track progress

---

**Phase 3 is the heart of the platform. Build this solid, and Safe Hands Escrow becomes market-ready.**

