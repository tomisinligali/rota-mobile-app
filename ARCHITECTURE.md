# System Architecture

Rota is a mobile-first shift scheduling platform built for businesses with 5–100 staff per team.

---

## 1. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Client Layer
        Mobile[Expo React Native Mobile App]
        Tablet[Tablet Station View]
    end

    subgraph Edge & API Gateway
        LB[Load Balancer / Nginx]
        AuthMW[Authentication & Session Middleware]
        RBAC[Team-Scoped Role Authorization]
        RateLimit[Redis Token Bucket Rate Limiter]
    end

    subgraph Application Layer
        Express[Express TypeScript API Server]
        DBRouter[Read/Write Query Router]
        CacheManager[Redis Cache Manager]
    end

    subgraph Background Asynchronous Processing
        BullMQ[BullMQ Job Queues]
        Worker[Background Worker Process]
    end

    subgraph Storage Layer
        PG_Primary[(PostgreSQL Primary - Writer)]
        PG_Replica[(PostgreSQL Replica - Reader)]
        PG_Shard0[(PostgreSQL Shard 0)]
        PG_Shard1[(PostgreSQL Shard 1)]
        Redis[(Redis Cache / Lock / Sessions)]
    end

    subgraph External Integrations
        ExpoPush[Apple APNs & Google FCM via Expo]
        Flutterwave[Flutterwave Payments API]
        SMTP[Google SMTP Service]
    end

    Mobile -->|HTTPS /api/v1| LB
    Tablet -->|HTTPS /api/v1| LB
    LB --> RateLimit
    RateLimit --> AuthMW
    AuthMW --> RBAC
    RBAC --> Express

    Express --> CacheManager
    CacheManager <--> Redis

    Express --> DBRouter
    DBRouter -->|Writes & Transactions| PG_Primary
    DBRouter -->|Read-Your-Own-Writes| PG_Primary
    DBRouter -->|Standard Reads| PG_Replica

    Express -->|Shard by team_id hash| PG_Shard0
    Express -->|Shard by team_id hash| PG_Shard1

    Express -->|Enqueue Outbox Delivery| BullMQ
    BullMQ <--> Redis
    BullMQ --> Worker

    Worker -->|Fetch Device Tokens| PG_Primary
    Worker -->|Send Push Notifications| ExpoPush
    Worker -->|Deliver Verification & Resets| SMTP
    Worker -->|Process Subscriptions & Webhooks| Flutterwave
```

---

## 2. Core Architectural Principles

### 2.1 Backend Authority
The backend Express API is the sole authority for:
- Authentication & revocable session management (Argon2id + JWT + refresh tokens).
- Multi-tenant isolation and role-based permissions (`OWNER`, `MANAGER`, `STAFF`).
- Shift conflict detection (`existing.start < new.end AND existing.end > new.start`).
- Optimistic concurrency and schedule publication transactions.
- Direct swap approvals and open-shift claim assignments.
- Authoritative subscription state and billing seat calculations.

The mobile application **never** connects directly to PostgreSQL or Redis.

### 2.2 Domain Hierarchy
```text
Business (Billing Boundary)
  └── Team (Scheduling & Authorization Boundary)
       └── TeamMembership (Role Boundary: OWNER, MANAGER, STAFF)
             └── User
```

- **Business**: Owns subscriptions, seat caps, Flutterwave customer tokens, and billing ledgers.
- **Team**: Scopes all shift schedules, swap requests, rosters, and audit activity feeds.
- **TeamMembership**: Dictates a user's role on that specific team. A user can be an `OWNER` on Team 1 and `STAFF` on Team 2.

---

## 3. Storage & Data Routing Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Mobile App (User)
    participant API as Express API
    participant Router as DB Router
    participant Redis as Redis Cache
    participant Primary as PostgreSQL Primary
    participant Replica as PostgreSQL Replica

    Note over User,Replica: 1. Mutation Workflow (Write)
    User->>API: POST /api/v1/shifts (Create Shift)
    API->>Router: queryRouted(INSERT ...)
    Router->>Primary: Execute INSERT & COMMIT
    Router->>Redis: recordUserWrite(userId, timestamp)
    Router->>Redis: bumpTeamVersion(teamId) [O(1) Invalidation]
    API-->>User: 201 Created { data: shift }

    Note over User,Replica: 2. Immediate Read Workflow (Read-Your-Own-Writes)
    User->>API: GET /api/v1/teams/:teamId/shifts (Refresh Calendar)
    API->>Router: queryRouted(SELECT ...)
    Router->>Redis: isWithinReplicationLag(userId)?
    Redis-->>Router: true (Write occurred < 5000ms ago)
    Router->>Primary: Route SELECT to Primary (Lag Protected)
    Primary-->>Router: Fresh shift calendar
    API-->>User: 200 OK { data: shifts }

    Note over User,Replica: 3. Cold Read Workflow (> 5s later)
    User->>API: GET /api/v1/teams/:teamId/shifts
    API->>Router: queryRouted(SELECT ...)
    Router->>Redis: isWithinReplicationLag(userId)?
    Redis-->>Router: false (Lag window expired)
    Router->>Replica: Route SELECT to Replica (Offload Read)
    Replica-->>Router: Shifts array
    API-->>User: 200 OK { data: shifts }
```

---

## 4. Asynchronous Processing & Outbox Pattern

To protect user requests against external service latency or network downtime:
1. **Durable Intent**: When an event occurs (e.g. shift publication or swap request), durable intent is written to `notifications` and `notification_outbox` inside the main PostgreSQL transaction.
2. **Background Dispatch**: A lightweight BullMQ job is enqueued to Redis (`notification-delivery`).
3. **Worker Execution**: The BullMQ worker claims jobs atomically, checks the recipient's quiet hours and timezone, and delivers push notifications to all registered user devices via Expo Push Service.
4. **Idempotency & Retries**: Failed jobs retry up to 5 times with exponential backoff and jitter. Dead-letter jobs remain inspectable.

---

## 5. Technology Stack Summary

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Mobile** | React Native (Expo SDK 52) | Cross-platform iOS & Android mobile application |
| **Backend Runtime** | Node.js 20 LTS | Asynchronous non-blocking API server |
| **Backend Framework** | Express 4.x + TypeScript | RESTful routing, domain services, middleware |
| **Primary Database** | PostgreSQL 16 | Durable source of truth, ACID transactions, exclusion constraints |
| **Cache & Distributed Lock**| Redis 7 | Transient cache, rate limiting, BullMQ backend, LWW timestamps |
| **Background Queue** | BullMQ | Reliable job execution, retry management, scheduled outbox delivery |
| **Payments** | Flutterwave | Subscription card payments, seat proration, webhooks |
| **Push Notifications** | Expo Push API | Multi-device push notification delivery |
| **Authentication** | Argon2id + JWT + OAuth | Secure password hashing, revocable refresh tokens, Google OAuth |
