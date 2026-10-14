# Settings Conflict Resolution & Last-Write-Wins (LWW) Architecture

This document details the architectural decisions, synchronization flow, and trade-offs of the user settings synchronization engine in Rota.

---

## 1. Problem Statement & Context

In a multi-device shift scheduling application, a user (e.g., Halima, a nurse manager) frequently uses multiple devices:
- A personal smartphone while on shift or commuting.
- A tablet mounted at the nurses' station or bedside.
- A desktop or laptop web dashboard.

Settings include:
- **Quiet Hours**: Start time, end time, and active toggle (e.g., `22:00` to `06:00`).
- **Time Zone**: Authoritative IANA time zone (e.g., `Africa/Lagos`, `America/New_York`).
- **Notification Category Types**: Push notification master switch, shift changes, swaps, and billing alerts.
- **Language**: User interface locale (e.g., `en`, `fr`, `es`, `de`).
- **Theme**: Display preference (`SYSTEM`, `LIGHT`, `DARK`).

When settings are edited across different devices or while network connectivity fluctuates, conflicts inevitably arise. The system requires an authoritative conflict resolution strategy that ensures consistency across all devices and guarantees that the server's background workers strictly obey the user's intent.

---

## 2. Chosen Architecture: Server-Authoritative Last-Write-Wins (LWW)

Rota implements **Server-Authoritative Last-Write-Wins (LWW)** with server-assigned timestamps.

### 2.1 The Server as the Single Source of Truth
In strict compliance with `AGENTS.md` (Section 2.2 and 2.3), the backend PostgreSQL database is the sole durable source of truth:
1. Client devices (iOS, Android, Web) **never** determine authoritative timestamps for business state.
2. The `user_settings` table stores an `updated_at TIMESTAMPTZ` column.
3. When any update request (`PUT /api/v1/users/settings`) is processed, PostgreSQL sets `updated_at = NOW()`.
4. The write that is committed most recently by the PostgreSQL database wins and becomes the canonical truth.

### 2.2 Partial Patching Mechanics
To minimize destructive collisions between independent settings, the server applies field-level updates:
```sql
INSERT INTO user_settings 
  (user_id, email_notifications, push_notifications, ..., language, theme, updated_at)
VALUES ($1, $2, $3, ..., $13, $16, NOW())
ON CONFLICT (user_id)
DO UPDATE SET
  quiet_hours_enabled = COALESCE($9, user_settings.quiet_hours_enabled),
  timezone = COALESCE($12, user_settings.timezone),
  language = COALESCE($13, user_settings.language),
  theme = COALESCE($16, user_settings.theme),
  updated_at = NOW()
RETURNING *;
```
If Device A updates `theme` and Device B updates `quietHoursStart`, neither clobbers the other's distinct field.

---

## 3. Why Last-Write-Wins (LWW) Was Chosen

1. **Elimination of Client Clock Drift & Manipulation**:
   Mobile device system clocks are notoriously unreliable. Devices may suffer from drifting hardware clocks, incorrect manual date settings, or intentional time spoofing. Relying on client-generated timestamps for conflict resolution allows a device with a clock set ahead to permanently lock out changes from other devices. By assigning `updated_at = NOW()` on the server, all timestamps are guaranteed to be monotonic and anchored to the synchronized database clock.

2. **Simplicity and Determinism for Scalar Preferences**:
   Unlike collaborative text documents or shift rosters (which have relational invariants and require optimistic concurrency version checks `version = version + 1`), user preferences are discrete scalar values. A user is either in quiet hours or not; their theme is either `DARK` or `LIGHT`. Full CRDTs (Conflict-free Replicated Data Types) or multi-way operational transformation introduce significant operational complexity, serialization bloat, and database storage overhead with no tangible benefit for scalar user settings.

3. **High Performance & Low Latency**:
   LWW resolves conflicts in $O(1)$ time within a single indexed SQL upsert transaction. No lock contention or recursive vector clock comparison is required.

---

## 4. Documented Weaknesses of Last-Write-Wins

While LWW is simple and robust, it possesses inherent trade-offs and edge-case weaknesses that must be acknowledged:

### Weakness 1: Arrival-Time Bias vs. Real-World Intent (Offline Ordering Inversion)
- **Scenario**: 
  1. At 14:00, Halima enters an underground hospital ward with no cellular service. On her phone, she sets Quiet Hours to `23:00 – 07:00`. The phone caches this change locally and queues the network request.
  2. At 14:05, Halima uses the ward's connected tablet and sets Quiet Hours to `22:00 – 06:00`. The server immediately receives and commits this update with `updated_at = 14:05:00`.
  3. At 14:15, Halima exits the ward. Her phone regains cellular reception and flushes its queued request to the server.
- **Consequence**: The server receives the phone's request at 14:15:02 and sets `updated_at = 14:15:02`. The phone's older human decision overrides the tablet's newer human decision purely because the phone's packet arrived later.

### Weakness 2: Blind Overwrites on Identical Fields
- **Scenario**:
  Two devices simultaneously modify the same setting (e.g., Device A toggles notifications OFF while Device B toggles notifications ON).
- **Consequence**:
  Whichever HTTP request finishes its database transaction milliseconds later silently wins. There is no automated prompt asking the user "You changed this on another device, which do you want to keep?"

### Weakness 3: Silent Reversion for Superseded Devices
- **Scenario**:
  A device makes an optimistic change in its local UI. If a concurrent change was committed to the server in the interim, the device's next poll or refetch will silently overwrite the user's screen state without explicit user notice.

---

## 5. Mitigations Implemented in Rota

To mitigate these weaknesses in production, Rota combines the server-authoritative LWW model with a multi-layered client coordination pattern:

### 5.1 Real-Time Foreground Synchronization (`AppState`)
In `Frontend/App.tsx`, an `AppState` listener triggers immediate query invalidation whenever the mobile application transitions from the background to `active`:
```typescript
const appStateSub = AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    queryClient.invalidateQueries({ queryKey: ['userSettings'] });
  }
});
```
When Halima picks up her tablet after changing settings on her phone, unlocking or switching to the Rota app immediately re-fetches the server's canonical state without requiring an app restart or reinstall.

### 5.2 Background Query Polling
React Query is configured with `refetchInterval: 15000` (15-second background polling) and `staleTime: 10000`. Even if a device remains open on the nurses' station desk, it automatically aligns with server updates within seconds.

### 5.3 Optimistic Updates with Rollback
Client-side mutations in `queries.ts` and `DashboardScreen.tsx` immediately update the local UI and SQLite storage cache for zero-latency user feedback. If the network request fails (e.g., timeout, server validation rejection, or connection loss), the client automatically rolls back to the previous snapshot and displays an alert.

### 5.4 Authoritative Server Enforcement in Background Jobs
Regardless of any client state discrepancies, the BullMQ background worker in `Backend/src/domains/notifications/queue.ts` directly queries the authoritative `user_settings` table in PostgreSQL before delivering any push notification:
1. Validates the recipient's `timezone`.
2. Evaluates `isInQuietHours` against the target time zone.
3. Automatically defers non-urgent notifications to `next_attempt_at = quietHoursEnd` while allowing urgent alerts to deliver immediately.
