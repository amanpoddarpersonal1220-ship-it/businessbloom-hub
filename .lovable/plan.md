
# Plan — Realtime TradeLedger (production-ready)

Goal: every relevant screen updates live across Admin, Employee, and Client without a refresh, backed by Supabase Realtime + Postgres, with reconnection handling, optimistic updates, presence, and audit logging of realtime events.

## 1. Database migration — enable Realtime + supporting objects

One migration doing all of the following:

- `ALTER TABLE ... REPLICA IDENTITY FULL` for: `orders`, `invoices`, `ledger_entries`, `credit_purse`, `tasks`, `employees`, `clients`, `audit_log`, `profiles`, `gst_verification`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE` for the same list.
- New `public.notifications` table (id, user_id, tone, title, body, entity_type, entity_id, read, created_at) with RLS: user sees only their own rows; service_role full; add to realtime publication. GRANTs per rules.
- New `public.realtime_events_log` (id, actor_id, channel, event_type, payload jsonb, created_at) — append-only audit of significant realtime events (order accepted, invoice approved, duty toggled, task status change). Insert via triggers.
- Postgres triggers to auto-insert notification rows on: new order for a client, order status change, invoice status change, new task assigned, task marked done, invoice becoming overdue (via scheduled function).
- Trigger to insert into `realtime_events_log` on the same events (actor from `auth.uid()`).
- Recompute triggers on `orders`/`invoices`/`ledger_entries` → refresh `credit_purse` used/remaining so client counters stay consistent live.

## 2. Realtime client infrastructure

New files under `src/lib/realtime/`:

- `useRealtimeTable.ts` — generic hook: subscribes to `postgres_changes` for a table + filter, invalidates matching TanStack Query keys, handles unmount cleanup, exponential-backoff reconnection, and offline/online detection via `navigator.onLine` + `supabase.realtime` status events.
- `usePresence.ts` — joins a per-role channel (`presence:admins`, `presence:employees`, `presence:tenant`) tracking `{ user_id, name, role, route, entity_id? }`; exposes `onlineUsers` and `whoIsViewing(entityType, entityId)`.
- `useEntityViewers.ts` — thin wrapper over presence that tracks viewers of a specific order/invoice for "Admin is viewing this order" badges.
- `RealtimeProvider.tsx` — mounts once in `_authenticated/route.tsx`; owns the shared client, presence channel, connection-status banner ("Reconnecting…"), and a global toast on push notifications.

## 3. Wire realtime into existing dashboards

Only presentational/data-fetching edits — no business-logic rewrites.

- `AdminDashboard.tsx`: subscribe to `orders`, `invoices`, `tasks`, `employees.duty_status`, `audit_log`. KPIs (outstanding dues, order volume, active employees) recompute from live query cache. Kanban cards animate on status change. Show green presence dot on employee rows. "X is viewing" badge on the order/invoice detail panels.
- `EmployeeDashboard.tsx`: subscribe to own `tasks`, own `orders`, assigned `clients`. Duty toggle already writes; add live badge reflecting admin-side edits. New-task toast via notifications channel.
- `ClientDashboard.tsx`: subscribe to own `orders`, `invoices`, `ledger_entries`, `credit_purse`. Accept/Decline buttons use optimistic mutation (TanStack Query `onMutate` + rollback on error) so the UI updates instantly and reconciles on the realtime echo.

## 4. Notification bell — real, not seeded

Replace the in-memory seed in `useNotifications.tsx` with:

- Initial query from `public.notifications` for the current user.
- Realtime subscription (`INSERT` on `notifications` filtered by `user_id=eq.<me>`) → prepends item + toast.
- `markAllRead` / per-item read → `UPDATE` on the row.
- Retains the "WhatsApp + in-app" label copy.

## 5. Presence, viewing indicators, live counters

- Presence dot in `AppShell` header (self) and next to employee/client names in admin tables.
- Order/Invoice approval screens show a small pill: "Admin Priya is viewing" when another user's presence entry matches this entity.
- Admin overview counters (`Outstanding`, `Orders today`, `Active employees`) derive from live-updated query caches — no polling.

## 6. Production hardening

- Reconnection: `RealtimeProvider` listens to `SYSTEM` / `CHANNEL_ERROR`, retries with backoff, shows a subtle top banner while disconnected, refetches all active queries on reconnect.
- Optimistic updates on: order Accept/Decline/Request-Changes, invoice Accept/Decline, task Start/Done, duty toggle. Rollback on error with toast.
- Audit: every optimistic mutation writes to `audit_log`; triggers additionally write to `realtime_events_log` for a tamper-evident feed.
- RLS: notifications and realtime_events_log locked to owner/admin; ensure existing per-table RLS already gates realtime payloads (Supabase applies RLS to realtime).
- Cleanup: all channels removed on unmount; single shared client; no per-render `.subscribe()`.

## 7. Verification

- Two-browser test script (Playwright) logging in as admin + client, punching an order, and asserting the client sees it within 2s; accepting reflects to admin within 2s.
- Kill the network tab, confirm banner appears, restore, confirm data reconciles.

## Technical notes

- Stack unchanged: TanStack Start + Supabase Realtime v2 (`supabase.channel(...).on('postgres_changes', ...)` + presence).
- All subscriptions live inside `useEffect` with cleanup, per realtime rules.
- No edge functions added; triggers + client subscriptions cover the flow.
- No schema-breaking changes to existing tables beyond `REPLICA IDENTITY FULL` and publication membership.

## Out of scope

- Real WhatsApp/SMS delivery (still simulated).
- Real GPS tracking.
- Mobile push notifications (browser toasts + bell only).
