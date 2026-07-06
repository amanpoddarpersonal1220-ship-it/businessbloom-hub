# B2B Trade & Credit Management Platform — Demo (v0)

A single codebase, role-based demo app. One login flow; the dashboard adapts to the logged-in role (Admin / Employee / Client). All third-party integrations (WhatsApp, SMS, GPS, OCR, telephony, GST verification) are simulated with mock data and toasts, clearly labeled in the UI.

## Decisions locked
- **Login:** One-click "Log in as Admin / Employee / Client" buttons that prefill and submit instantly, plus a visual-only 4-digit OTP step that auto-accepts any input.
- **Visual style:** Clean fintech (light) — palette `#0F172A` (ink), `#2563EB` (primary blue), `#0EA5E9` (teal accent), `#F1F5F9` (surfaces). Data-dense modern SaaS admin feel.
- **RLS:** Real per-role Row-Level Security (clients see only their own data; employees see assigned clients; admins see all).
- **Build order:** Core first, then expand.

## Tech & backend
- React + TanStack Start (file-based routing under `src/routes/`), Tailwind v4, shadcn/ui, Recharts for charts.
- Lovable Cloud (Supabase) for auth, Postgres, storage. Enable Cloud as step 1.
- All user-scoped reads/writes via `createServerFn` with `requireSupabaseAuth`; RLS enforced.

## Design system
- Fonts via `@fontsource` (Figtree for UI/body, Space Grotesk for headings/numbers).
- Semantic tokens in `src/styles.css` (`@theme inline`) — no hardcoded colors in components.
- Status colors: blue=pending/info, green=paid/verified/done, amber=due-soon/needs-approval, red=overdue/declined.
- Shared app shell: role-aware sidebar nav, top bar with notification bell + notification center, duty toggle (employee).

## Data model (Supabase tables, all with GRANTs + RLS + `has_role` security-definer fn)
- `app_role` enum (admin/employee/client) + `user_roles` table (roles NOT stored on profiles).
- `profiles` (id, role mirror for display, name, phone_masked, email).
- `clients` (gst_number, pan, phone, credit_limit, credit_terms 30/45/60, penalty_rate, verified, assigned_employee_id).
- `gst_verification` (separate module table: client_id, status, provider placeholder) so a real API plugs in later.
- `employees` (profile_id, order_limit, duty_status, base_salary + payslip fields).
- `orders` (client_id, employee_id, type PO/SO, status Pending→Confirmed→Invoiced→Paid, items jsonb, value, needs_admin_approval).
- `invoices` (order_id, status Sent/Approved/Declined/Overdue, due_date, amount).
- `ledger_entries` (client_id, type, amount, running_balance).
- `credit_purse` (client_id, used, remaining).
- `tasks` (employee_id, title, description, status, due_date).
- `audit_log` (actor_id, action, target, timestamp).
- Seed migration: 3 demo auth users (admin/employee/client) with roles, a handful of clients, orders across all pipeline states, ≥1 overdue invoice, ≥1 flagged order, tasks, ledger rows.

## Routing
- `src/routes/auth.tsx` — role buttons + OTP step (public).
- `src/routes/_authenticated/route.tsx` — managed gate (ssr:false, redirect to /auth).
- `_authenticated/dashboard.tsx` — role switch renders Admin / Employee / Client dashboard.
- Sub-routes per major area (orders, invoices, clients, employees, tasks, reports).

---

## Phase 1 — Core (this build)
1. Enable Lovable Cloud; run schema + RLS + seed migrations.
2. Auth: one-click role login + visual OTP; role-based routing; role-aware app shell + notification bell.
3. **Client dashboard:** order confirmation (Accept/Decline/Request Changes), invoice approval, credit timeline with auto due dates, due/overdue banners, ledger/Hisab table, penalty display, KYC read view.
4. **Employee dashboard:** large-button UI, assigned client list with masked phones + UI-only Call toast, WhatsApp-labeled send buttons (toast), duty On/Off toggle, task list (mark In Progress/Done), order punch form with per-employee limit flagging.
5. **Admin dashboard:** client CRUD + KYC verified toggle + credit limit/terms/penalty, order management (status pipeline table), invoice management (status tracking), credit purse widget, overdue accounts view.
6. In-app notifications (toast + notification center) labeled "WhatsApp + in-app".

## Phase 2 — Expand (fast-follow)
- Employee: "Upload/Scan Order Slip" image upload → simulated OCR autofill; static demo map with mock field-visit pins.
- Admin: employee CRUD + performance summary, payslip generator (printable/PDF), reporting dashboard charts (outstanding dues, sales by client/employee, order volume trends), audit log table.
- gst_verification module surfaced in admin UI (manual toggle, API-ready).

## Technical notes
- `has_role(uid, role)` security-definer function for all role checks in RLS (avoids recursion).
- Credit purse + ledger running balance recomputed via server functions on order/payment change.
- Due dates/penalties computed from stored dates + configurable rate fields.
- Phone masking enforced at UI layer for employees (`+91 98••••••10`), non-copyable.
- Basic Zod validation on all forms, client + server.

I'll start with Phase 1 after you approve.