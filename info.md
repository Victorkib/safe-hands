# 🛡️ Safe Hands Escrow Platform — Developer Blueprint

## 1. Project Overview

Safe Hands is a **web-based escrow platform** designed to secure peer-to-peer transactions on **Kenyan social media marketplaces** (Instagram, TikTok).
It integrates with **M‑Pesa (Daraja API)** and uses **Supabase** for authentication and data storage.

### 🎯 Core Goals

- Protect buyers and sellers from fraud.
- Hold payments in escrow until delivery confirmation.
- Provide transparent transaction tracking and dispute resolution.
- Support Kenya’s digital commerce ecosystem.

---

## 2. Tech Stack

| Layer         | Technology               | Purpose                             |
| ------------- | ------------------------ | ----------------------------------- |
| Frontend      | Next.js (JavaScript)     | UI rendering, routing, SSR          |
| Backend       | Next.js API routes       | Business logic, M‑Pesa integration  |
| Database      | Supabase (PostgreSQL)    | User, transaction, and dispute data |
| Auth          | Supabase Auth            | Secure user authentication          |
| Payment       | M‑Pesa Daraja API        | Escrow deposits and releases        |
| Notifications | Twilio / SendGrid        | SMS & email alerts                  |
| Hosting       | Vercel                   | Frontend + API deployment           |
| Admin Panel   | Next.js + Supabase roles | Dispute management & monitoring     |

---

## 3. System Architecture

### 🧩 Modules

1. **User Authentication**
   - Supabase Auth (email/password, OAuth optional)
   - Role-based access: Buyer, Seller, Admin

2. **Escrow Service**
   - Create transaction → Hold funds → Confirm delivery → Release funds
   - Integrate M‑Pesa Daraja API for payment flow

3. **Dispute Management**
   - Buyer/Seller submit evidence
   - Admin reviews and decides outcome
   - Funds released or refunded accordingly

4. **Notification System**
   - Real-time updates via Supabase Realtime
   - SMS/email alerts for transaction status

5. **Admin Dashboard**
   - Transaction monitoring
   - Fraud detection
   - Dispute resolution interface

---

## 4. Folder Structure

safehands/
├── app/
│ ├── layout.js
│ ├── page.js
│ ├── buyer/
│ ├── seller/
│ ├── admin/
│ └── api/
│ ├── escrow/
│ ├── dispute/
│ └── mpesa/
├── lib/
│ ├── supabaseClient.js
│ ├── mpesaClient.js
│ └── utils.js
├── components/
│ ├── Navbar.js
│ ├── TransactionCard.js
│ ├── DisputeForm.js
│ └── NotificationBanner.js
├── styles/
│ └── globals.css
└── README.md

---

## 5. Database Schema (Supabase)

### `users`

| Field      | Type                           | Description       |
| ---------- | ------------------------------ | ----------------- |
| id         | UUID                           | Primary key       |
| name       | Text                           | Full name         |
| email      | Text                           | Unique email      |
| role       | Enum('buyer','seller','admin') | User role         |
| created_at | Timestamp                      | Registration date |

### `transactions`

| Field      | Type                                                         | Description                  |
| ---------- | ------------------------------------------------------------ | ---------------------------- |
| id         | UUID                                                         | Primary key                  |
| buyer_id   | UUID                                                         | FK → users                   |
| seller_id  | UUID                                                         | FK → users                   |
| amount     | Numeric                                                      | Transaction amount           |
| status     | Enum('initiated','escrow','delivered','released','refunded') | Workflow state               |
| mpesa_ref  | Text                                                         | M‑Pesa transaction reference |
| created_at | Timestamp                                                    | Creation date                |

### `disputes`

| Field          | Type                                   | Description       |
| -------------- | -------------------------------------- | ----------------- |
| id             | UUID                                   | Primary key       |
| transaction_id | UUID                                   | FK → transactions |
| raised_by      | UUID                                   | FK → users        |
| description    | Text                                   | Dispute details   |
| evidence_url   | Text                                   | Uploaded proof    |
| status         | Enum('open','under_review','resolved') | Review state      |
| resolution     | Text                                   | Admin decision    |
| created_at     | Timestamp                              | Date raised       |

---

## 6. API Endpoints

| Endpoint               | Method | Description                  |
| ---------------------- | ------ | ---------------------------- |
| `/api/auth/signup`     | POST   | Register user                |
| `/api/auth/login`      | POST   | Authenticate user            |
| `/api/escrow/create`   | POST   | Initiate transaction         |
| `/api/escrow/release`  | POST   | Release funds after delivery |
| `/api/dispute/create`  | POST   | Raise dispute                |
| `/api/dispute/resolve` | POST   | Admin resolves dispute       |
| `/api/mpesa/callback`  | POST   | Handle M‑Pesa webhook        |

---

## 7. M‑Pesa Integration Flow

1. Buyer initiates transaction → funds sent to escrow account.
2. M‑Pesa API confirms payment → callback updates transaction status.
3. Seller delivers goods → buyer confirms delivery.
4. Escrow releases funds → M‑Pesa disburses to seller.
5. If dispute arises → admin reviews → refund or release.

---

## 8. Development Phases (Agile)

### 🧱 Phase 1 — MVP

- User registration/login
- Escrow transaction creation
- M‑Pesa sandbox integration
- Basic UI for buyer/seller

### ⚙️ Phase 2 — Core Features

- Transaction tracking
- Delivery confirmation
- Dispute submission
- Admin dashboard

### 🚀 Phase 3 — Enhancements

- Notifications (SMS/email)
- Analytics dashboard
- Multi-platform support (Instagram, TikTok)
- Security hardening (HTTPS, input validation)

### 🧪 Phase 4 — Testing & Deployment

- Unit tests (Jest)
- Integration tests (Playwright)
- Deploy to Vercel
- Connect production Supabase & M‑Pesa credentials

---

## 9. Security Considerations

- HTTPS enforced on all routes.
- JWT-based session management.
- Input validation & sanitization.
- Role-based access control.
- Secure storage of M‑Pesa credentials (env variables).

---

## 10. Future Scalability

- Add support for other payment gateways (Stripe, PayPal).
- Expand to other social platforms.
- Implement automated dispute arbitration using AI.
- Introduce mobile app (React Native).

---

## 11. References

Derived from _Mercy Waithera’s Safe Hands Project Proposal (2026)_ — sections on background, problem statement, objectives, and methodology.

---

## 12. License

MIT License — Open for educational and commercial adaptation.
