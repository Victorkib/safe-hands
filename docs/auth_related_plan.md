## **Regenerated Implementation Plan (No Duplicate Utility Files)**

### **Guiding rule**

- Reuse and harden existing files in `safe-hands/lib`.
- If two files overlap, pick one canonical owner and retire the other path gradually.
- No parallel “v2” auth/supabase files.

---

## **0) Canonical ownership (decide once)**

Use these as the only long-term sources:

- `lib/supabaseClient.js` → **browser client/session lifecycle**
- `lib/getServerSupabase.js` → **cookie-based server auth client**
- `lib/apiAuth.js` → **API auth resolver (cookie first, bearer fallback)**
- `lib/supabaseAdmin.js` → **service-role only**
- `context/AuthContext.js` → **global client auth state machine**

De-prioritize/retire:

- `lib/authMiddleware.js` (already deprecated; keep as legacy stub only)
- Direct `createClient(...)` in API route files where `apiAuth` + shared clients should be used.

---

## **Phase 1 — Stabilize auth/session lifecycle (core fix for idle hangs)**

### **1.1 Harden** `context/AuthContext.js`

Where: `safe-hands/context/AuthContext.js`

- Add explicit states: `initializing`, `authenticated`, `unauthenticated`, `recovering`, `error`.
- Keep existing timeout idea, but apply it to:
  - initial `getUser()`
  - profile fetch
  - auth-change profile refresh
- Add recovery on `visibilitychange` and `window.focus`:
  - trigger `supabase.auth.getSession()` + `getUser()`
  - if stale, recover and broadcast context update
- Expose helpers from context (no new file required), e.g.:
  - `refreshAuth()`
  - `ensureSession()`

Why: this is the center of your “idle then infinite loading” issue.

---

## **Phase 2 — Remove page-level auth drift**

### **2.1 Standardize dashboard pages on context gate**

Where: all `app/dashboard/**/page.js`

- Stop each page from independently bootstrapping auth with `supabase.auth.getSession()` unless strictly needed.
- Pattern:
  - if `authLoading` return shared loading
  - if no `user` redirect + finalize local loading
  - else fetch business data
- Ensure every early return path resolves local `loading` (no orphan spinner).

High-risk pages first:

- `app/dashboard/buyer/page.js`
- `app/dashboard/seller/page.js`
- `app/dashboard/admin/page.js`
- `app/dashboard/transactions/[id]/page.js`
- `app/dashboard/disputes/[id]/page.js`
- `app/dashboard/profile/page.js`

---

## **Phase 3 — API consistency (without new files)**

### **3.1 Use** `lib/apiAuth.js` **everywhere protected**

Where: `app/api/`**

- Replace ad hoc token parsing or direct auth checks with `getAuthenticatedUser`.
- For role checks, query role once after user resolution.
- Remove mixed patterns that can disagree after idle token refresh.

### **3.2 Reuse** `getServerSupabase` **for server-side DB ops**

- No per-route `createClient` duplication unless absolutely necessary.
- If service role is needed, use `supabaseAdmin.js` only.

---

## **Phase 4 — Timeout + retry strategy (implemented inside existing files)**

No new `resilientClient.js` for now (per your rule).  
Instead:

- Add small helper functions inside:
  - `AuthContext.js` (auth timeouts/recovery)
  - critical pages (or shared local helper within each file first)
- Apply:
  - timeout (8-12s)
  - 1 retry for retriable failures
  - abort on unmount/navigation

This gives resilience now, without introducing another utility module.

---

## **Phase 5 — Reduce utility overlap in** `lib`

### **5.1** `lib/userService.js`

- Keep it for profile/admin operations.
- Ensure it does not conflict with `AuthContext` assumptions.
- Prefer this for user profile normalization so pages don’t duplicate merge logic.

### **5.2** `lib/notificationService.js`

- It currently creates its own Supabase client; move toward `supabaseAdmin` usage for privileged inserts to avoid scattered client creation.

### **5.3** `lib/authMiddleware.js`

- Keep as deprecated stub only, do not use anywhere.
- Optionally mark with stronger lint/comment guard so nobody imports it again.

---

## **Phase 6 — Guardrails and verification**

### **6.1 Build and route smoke matrix**

After each batch:

- `npm run build`
- Manual flows:
  - login -> idle 5-15 mins -> navigate dashboard pages
  - leave tab hidden -> return -> navigate
  - long session admin pages
  - dispute + transaction detail paths

### **6.2 Add minimal runtime diagnostics (in existing files)**

- In `AuthContext`, log state transitions and timeout recoveries (dev-only).
- In page fetches, log timeout vs auth failure vs data failure.

---

## **“Terminate duplicates” checklist (safe cleanup plan)**

1. **Stop new usage** of any non-canonical auth helpers first.
2. Migrate consumers to canonical files above.
3. After zero references:
  - Keep `authMiddleware.js` as legacy doc OR remove in a dedicated cleanup PR.
4. Avoid adding any new supabase/auth utility file until these are fully consolidated.

---

## **Net result you’ll get**

- One coherent auth/session flow.
- No silent spinner deadlocks after idle.
- Fewer utility files doing the same thing.
- Safer long-term maintainability without “file sprawl.”

If you approve, next I can convert this into a strict execution sequence (Patch Set 1, 2, 3...) with exact files per set and rollback-safe checkpoints before coding.