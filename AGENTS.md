# Rota --- AI Coding Agent Instructions

## 1. What Is This Project?

Rota is a mobile-first shift scheduling application for small businesses
with approximately 5--100 staff per team.

Rota helps owners and managers:

-   Create and manage teams and locations.
-   Invite and manage staff.
-   Create one-time and recurring shifts.
-   Build draft schedules.
-   Publish schedules.
-   Detect scheduling conflicts.
-   Consider staff availability and preferences.
-   Manage direct swaps and open shifts.
-   Notify affected staff reliably.
-   Manage a subscription based on active staff seats.

Staff use Rota to view schedules, manage availability/preferences,
request swaps, offer shifts, claim eligible open shifts, and receive
notifications.

Rota is not a payroll, attendance, clock-in/out, tax, recruitment,
benefits, or full HRIS product.

### Source of truth

The PRD defines product requirements and business behavior. This file
defines how the coding agent must implement those requirements.

When a requirement is explicitly locked in the PRD or in this file, do
not substitute another technology or architecture because it appears
easier.

### Phase discipline

Build only the phase explicitly requested.

-   Phase 1 is the MVP scheduling product.
-   Phase 2 contains AI scheduling and growth capabilities.
-   Phase 3 contains advanced workforce features and integrations.

Do not implement later-phase features early unless the user explicitly
authorizes them.

------------------------------------------------------------------------

## 2. What Is Locked?

### 2.1 Technology stack

The following stack is locked:

  Layer                                       Locked technology
  ------------------------------------------- -------------------------------
  Mobile                                      React Native
  Mobile framework                            Expo
  Backend runtime                             Node.js LTS
  Backend framework                           Express
  Language                                    TypeScript
  Primary database                            PostgreSQL
  Cache / rate limiting / distributed locks   Redis
  Background job queue                        BullMQ running on Redis
  Development environment                     Antigravity
  Billing provider                            Flutterwave
  Notifications                               Push + email providers
  AI                                          External AI provider, Phase 2

Do not replace Express with Hono, Fastify, NestJS, or another backend
framework.

Do not replace PostgreSQL with another database.

Do not introduce a different queue system when BullMQ is sufficient.

Do not introduce another payment provider for the Rota billing
implementation unless the product requirements are explicitly changed.

A hosted Redis free tier such as Upstash is acceptable for
development/MVP when its limits and operational characteristics are
sufficient.

### 2.2 Backend authority

The backend is authoritative for:

-   Authentication.
-   Authorization.
-   Business and team membership.
-   Scheduling rules.
-   Conflict detection.
-   Swap approval and execution.
-   Billing state.
-   Audit records.
-   Idempotency.
-   Business transactions.

The mobile application must never connect directly to PostgreSQL or
Redis for business operations.

The mobile application communicates with the Express API.

### 2.3 Database authority

PostgreSQL is the authoritative source for durable business state.

Redis is not the source of truth for:

-   Users.
-   Businesses.
-   Teams.
-   Memberships.
-   Shifts.
-   Swaps.
-   Billing state.
-   Audit history.

Redis is for caching, rate limiting, distributed locks, and BullMQ
infrastructure.

Do not assume that cached Redis data is authoritative.

### 2.4 Background jobs

BullMQ is the required background queue and runs on Redis.

Use it for work such as:

-   Push notifications.
-   Email delivery.
-   Invitation delivery.
-   Billing reconciliation.
-   Notification retries.
-   Recurring schedule generation where required.
-   Phase 2 AI processing where asynchronous execution is appropriate.

Queue work must be retry-safe and idempotent.

A queue job must not bypass normal authorization, validation,
transaction, audit, or business-rule boundaries.

### 2.5 Billing

Flutterwave is the locked payment provider.

Keep Flutterwave-specific code behind a billing integration boundary.
The rest of the application must operate on Rota's own subscription and
billing domain model rather than directly depending on Flutterwave
response shapes.

Flutterwave webhooks are treated as at-least-once delivery. Provider
event IDs must be persisted and deduplicated before applying billing
effects.

### 2.6 Product boundaries

The primary ownership hierarchy is:

``` text
Business
  └── Team
       └── TeamMembership
             └── User
```

-   Business is the billing boundary.
-   Team is the scheduling and authorization boundary.
-   TeamMembership is the role/access boundary.
-   A user may belong to multiple teams.
-   A user may have different roles in different teams.
-   A business has one owner in the MVP model.

### 2.7 Roles

Roles are team-scoped:

-   OWNER
-   MANAGER
-   STAFF

Never store a single global role on `User` when the behavior belongs to
a team membership.

### 2.8 Authentication

MVP authentication uses backend-controlled email/password
authentication.

Use secure adaptive password hashing such as Argon2id.

Sessions must be server-controlled, revocable, and securely configured.

Email verification and password reset secrets must be single-use and
time-limited. Never use `Math.random()` or Node's `crypto.randomInt()` to
generate verification codes; use `crypto.randomBytes()` instead.

Rate-limit registration, login, password reset, invitation, and other
sensitive operations.

Google OAuth is not an MVP requirement unless explicitly authorized.

### 2.9 Billing model

Rota uses business-level subscriptions based primarily on active staff
seats.

-   Owners manage billing.
-   Managers are not billable by default.
-   Staff are billable seats.
-   Trial duration is 14 days by default.
-   There is no permanent free plan.
-   Billing failures enter a grace period before restricted mode.
-   The initial grace period is 7 days unless the product requirements
    change.
-   Billing problems must never delete scheduling history.

### 2.10 Scheduling

Schedules are authoritative business data.

Support:

-   One-time shifts.
-   Recurring shifts.
-   Draft schedules.
-   Published schedules.
-   Shift cancellation.
-   Historical shifts.
-   Team/location timezones.
-   Conflict detection.
-   Availability and preferences as advisory information.

Use actual datetimes for shifts. A shift may cross midnight.

Published shifts are cancelled rather than hard-deleted.

Use optimistic concurrency/versioning for mutable scheduling records.

Where feasible, enforce confirmed/published shift overlap at the
PostgreSQL level as well as in application validation.

### 2.11 Swaps

Direct swaps and open shifts are separate workflows.

MVP requires manager approval before a direct swap or open-shift claim
becomes final.

Approval must revalidate the current database state inside the
transaction that performs the assignment change.

Do not rely on a stale client view when executing a swap.

Do not create a misleading durable `APPROVED` state if approval and
execution are supposed to happen atomically. Model the lifecycle so the
final assignment change and approval decision remain consistent.

### 2.12 Notifications

Notification creation must be durable.

Schedule publication must not wait synchronously for push/email
delivery.

Use transactional application logic/outbox-style durability plus BullMQ
for asynchronous delivery.

Notification delivery must support retries and duplicate protection.

### 2.13 Idempotency

Mutations that can safely be retried must support `Idempotency-Key`
where required by the PRD.

For the same valid key and same request, return the original result.

For the same key with a materially different request, return a
conflict/error rather than applying a second operation.

Persist enough information to make this behavior reliable across retries
and worker/API restarts.

### 2.14 AI boundary

AI is Phase 2.

AI output is untrusted input.

AI must never directly mutate the database or receive unrestricted
database/tool access.

AI scheduling proposals must pass:

1.  Authentication.
2.  Authorization.
3.  Structured-output validation.
4.  Business-rule validation.
5.  Conflict checks.
6.  Explicit user confirmation.
7.  Normal application API execution.
8.  Transactional persistence.
9.  Audit logging.
10. Required notification/outbox behavior.

Ambiguous AI requests should ask for clarification rather than guessing.

------------------------------------------------------------------------

## 3. What Must Never Happen?

Breaking any rule in this section means the implementation is incorrect
even if the feature appears to work.

### Security and tenant isolation

-   Never trust a client-provided `businessId` or `teamId` as proof of
    access.
-   Never authorize access from an object ID alone.
-   Never rely on the mobile UI to hide unauthorized actions.
-   Never allow a user to read or mutate another business's or team's
    data.
-   Never let a manager access unrelated teams.
-   Never let staff perform manager/owner operations.
-   Never expose secrets in source control, logs, API responses, or
    audit records.
-   Never return raw internal exceptions to clients.
-   Never weaken authentication or rate limiting to make a test pass.

### Scheduling integrity

-   Never create a confirmed/published overlapping shift for the same
    staff member when the overlap rule blocks it.
-   Never bypass PostgreSQL/application conflict checks because the
    request came from a trusted-looking client.
-   Never silently change a shift's timezone because of the user's
    physical location.
-   Never rewrite historical shifts when changing a recurrence rule.
-   Never hard-delete published shifts when the product requires
    cancellation and history preservation.
-   Never let a stale client overwrite a newer schedule edit.
-   Never publish a schedule partially when a required transactional
    publication should fail as a whole.
-   Never make notification delivery determine whether schedule
    publication succeeds.

### Swap integrity

-   Never finalize a swap using stale shift or membership state.
-   Never allow an inactive member to become the final assignee.
-   Never bypass required manager approval.
-   Never allow two competing swap executions to produce contradictory
    assignments.
-   Never create duplicate assignment effects because a request was
    retried.

### Billing integrity

-   Never use client-side billing state as authoritative.
-   Never mark a Flutterwave webhook as processed only after applying
    effects without protecting against duplicate delivery.
-   Never create duplicate subscription effects from repeated webhook
    events.
-   Never assume webhook events arrive in order.
-   Never delete scheduling history because a subscription becomes past
    due, restricted, or cancelled.
-   Never hard-code provider response objects throughout the
    application; isolate Flutterwave integration logic.

### Queue/reliability integrity

-   Never treat Redis as the durable source of business truth.
-   Never assume a BullMQ job runs exactly once.
-   Never make a queue job unsafe to retry.
-   Never allow duplicate job execution to create duplicate business
    effects.
-   Never leave a failed/stuck job permanently unrecoverable.
-   Never put long-running asynchronous work directly into a request
    when the PRD requires background processing.
-   Never bypass database transactions for multi-step business state
    changes.

### Audit integrity

-   Never silently mutate or remove ordinary audit history.
-   Audit sensitive actions with enough information to identify actor,
    business/team scope, action, affected entity, and relevant
    before/after state where appropriate.
-   Never store passwords, reset secrets, session secrets, payment
    secrets, or other sensitive credentials in audit logs.

### Scope integrity

-   Never add payroll, attendance, clock-in/out, recruitment, benefits,
    full HRIS, or other explicitly excluded product scope.
-   Never build Phase 2 AI as part of an MVP task unless explicitly
    requested.
-   Never add complex offline mutation synchronization to MVP.
-   Never introduce a new framework or infrastructure product because it
    is personally preferred.

------------------------------------------------------------------------

## 4. How Is the Work Arranged?

Use a domain-oriented monorepo unless the existing repository has an
explicitly approved structure that must be preserved.

Recommended structure:

``` text
/
├── apps/
│   ├── mobile/
│   ├── api/
│   └── worker/
├── packages/
│   ├── shared/
│   ├── validation/
│   └── config/
├── db/
│   ├── migrations/
│   └── seeds/
├── tests/
├── docs/
├── .env.example
├── .gitignore
├── AGENTS.md
├── package.json
├── tsconfig.json
└── README.md
```

### API organization

Organize the Express API by domain rather than one giant
routes/controller file.

Recommended domains:

``` text
auth
businesses
teams
memberships
invitations
schedules
shifts
availability
preferences
swaps
notifications
billing
audit
ai
```

Each domain should keep related routes/controllers, validation,
services, and persistence logic close together where practical.

### Database boundary

All PostgreSQL access must occur through the backend.

Keep migrations version-controlled.

Use PostgreSQL constraints and indexes for important integrity and query
requirements.

Do not introduce an ORM as a hidden architectural requirement without an
explicit product/architecture decision. The PRD does not lock Prisma.

### Redis boundary

Use Redis only for concerns appropriate to ephemeral/shared
infrastructure:

-   Cache.
-   Rate limiting.
-   Distributed locks.
-   BullMQ.

Cache invalidation must never be the only mechanism protecting business
correctness.

### Worker boundary

The worker is responsible for asynchronous jobs, not arbitrary business
mutations outside normal domain services.

Workers should call shared domain/application services that enforce the
same business rules as API requests.

### Billing boundary

Keep Flutterwave integration isolated, for example:

``` text
billing/
  domain/
  application/
  infrastructure/
    flutterwave/
```

Do not spread Flutterwave-specific payload shapes throughout scheduling,
teams, or UI code.

### Mobile boundary

The mobile app:

-   Calls the Express API.
-   Does not access PostgreSQL.
-   Does not access Redis.
-   Does not contain authoritative business rules.
-   May mirror validation for user experience.
-   Must handle loading, refreshing, error, and empty states.
-   May cache recently loaded schedules for read-only viewing in MVP.
-   Requires connectivity for mutations.

### Testing organization

Keep unit, integration, API, and domain/concurrency tests organized so
the critical scheduling and authorization paths are easy to locate.

At minimum, test:

-   Authentication.
-   Tenant isolation.
-   Role authorization.
-   Shift overlap protection.
-   Optimistic concurrency.
-   Schedule publication.
-   Recurrence behavior.
-   Swap execution.
-   Notification enqueueing.
-   Idempotency.
-   BullMQ job retry/idempotency behavior.
-   Flutterwave webhook duplication/out-of-order behavior.
-   Billing lifecycle.
-   Audit logging.

------------------------------------------------------------------------

## 5. How Should the Code Look?

### TypeScript

-   Use strict TypeScript.
-   Avoid `any` unless there is a documented and unavoidable boundary
    reason.
-   Prefer explicit domain types and discriminated unions for stateful
    workflows.
-   Keep functions small enough to understand and test.
-   Prefer clear names over clever abstractions.
-   Do not duplicate critical business rules across many routes.

### Express API

Routes should be thin.

A typical flow should be:

``` text
route
  -> authentication
  -> authorization
  -> request validation
  -> domain/application service
  -> transaction/persistence
  -> audit/outbox when required
  -> response
```

Do not put database-heavy business logic directly inside route handlers.

### Validation

Validate every external input on the server.

Client-side validation is for UX only and must never replace server
validation.

Return consistent API errors using the PRD envelope:

``` json
{
  "error": {
    "code": "SHIFT_CONFLICT",
    "message": "The staff member already has an overlapping shift.",
    "details": {}
  }
}
```

Successful responses should follow the PRD's `{data, meta}` convention
where applicable.

Use `/api/v1/` for API versioning.

### Database and transactions

Use transactions for operations that must change multiple related
records atomically, including:

-   Swap execution.
-   Role changes with related membership effects.
-   Schedule publication.
-   Billing state changes that must stay synchronized locally.
-   Confirmed AI scheduling actions.
-   Durable outbox/event creation with the business mutation.

Use PostgreSQL constraints as a final integrity layer where practical.

### Time and dates

-   Store shift instants in a timezone-safe representation.
-   Preserve the relevant team/location IANA timezone.
-   Never derive scheduled time from the user's current physical
    location.
-   Explicitly handle daylight-saving transitions where applicable.
-   Treat cross-midnight shifts as one real interval.

### Money

Store monetary values as whole numbers in the smallest currency unit.

Never use floating-point arithmetic for money.

### Concurrency

Use optimistic concurrency/version checks for mutable scheduling
records.

For distributed coordination, use Redis locks only where a lock is
actually required; do not use a Redis lock as a substitute for
PostgreSQL transactional integrity.

### Queue jobs

BullMQ jobs must:

-   Have explicit job names/types.
-   Be idempotent.
-   Have bounded retries.
-   Use backoff appropriate to the failure.
-   Avoid duplicating side effects.
-   Record enough application state for troubleshooting/reconciliation
    where required.

### Error handling

Use typed, stable application error codes.

Do not leak stack traces, SQL errors, provider secrets, or internal
infrastructure details to clients.

Log enough server-side context to diagnose failures without logging
secrets or unnecessary personal data.

### Security

-   Use secure session cookies/tokens according to the authentication
    design.
-   Hash passwords with Argon2id.
-   Store only secure representations of reset/verification secrets.
-   Rate-limit sensitive endpoints.
-   Validate webhook authenticity.
-   Protect against duplicate webhook processing.
-   Apply authorization on every protected operation.
-   Never trust client-provided tenant identifiers.

### Mobile code

Every network-dependent screen needs:

-   Initial loading state.
-   Refreshing state where appropriate.
-   Error state.
-   Empty state.

Use accessible labels, sufficient touch targets, dynamic text sizing,
and status indicators that do not rely on color alone.

### Icon conventions

Use `Ionicons` from `@expo/vector-icons` consistently across the mobile application:

-   Active / selected state: use the filled icon name (e.g. `calendar`, `newspaper`, `person`, `swap-horizontal`, `notifications`, `card`, `settings`).
-   Inactive / unselected state: use the `-outline` variant (e.g. `calendar-outline`, `newspaper-outline`, `person-outline`, `swap-horizontal-outline`, `notifications-outline`, `card-outline`, `settings-outline`).
-   Do not use raw Unicode emojis for standard navigation, buttons, and system controls.

### Code comments

Comment the reason for non-obvious decisions, especially:

-   Concurrency controls.
-   PostgreSQL-specific constraints.
-   Redis locks.
-   BullMQ retry behavior.
-   Flutterwave webhook handling.
-   Timezone/DST behavior.
-   Security-sensitive logic.

Do not write comments that merely restate obvious code.

------------------------------------------------------------------------

## 6. What Counts as Done?

A task is done only when all applicable requirements and integrity rules
are satisfied.

### Requirements

-   The requested feature exists.
-   The feature matches the PRD.
-   All relevant business rules are enforced server-side.
-   Authorization is enforced for every protected operation.
-   Tenant isolation is verified.

### Data

-   Required PostgreSQL tables/columns/constraints/indexes exist.
-   Migrations are reproducible.
-   Seed/test data does not violate business rules.
-   Historical data behavior is preserved.

### API

-   Request validation exists.
-   Response/error formats follow the API contract.
-   Idempotency is implemented where required.
-   Errors are safe and actionable.

### Reliability

-   Required asynchronous work uses BullMQ.
-   Redis usage is appropriate and non-authoritative.
-   Jobs are retry-safe and idempotent.
-   Failure and recovery behavior is tested.
-   Webhooks are authenticated, persisted, deduplicated, and retry-safe.

### Billing

-   Flutterwave is the only configured payment provider.
-   Provider-specific code is isolated.
-   Subscription state remains correct if webhook delivery is duplicated
    or delayed.
-   Billing failures do not destroy scheduling history.

### Scheduling

-   Overlap rules are enforced.
-   Concurrency rules are enforced.
-   Publication is transactional where required.
-   Recurring shifts preserve historical instances.
-   Published shifts are cancelled rather than destroyed.
-   Swap execution revalidates current state transactionally.

### Tests

Run the relevant test suite and include tests for the critical path
changed by the task.

For infrastructure-heavy changes, include failure/retry/concurrency
cases rather than testing only the happy path.

### Quality checks

Before declaring completion, run the repository's applicable:

-   Type check.
-   Lint.
-   Unit tests.
-   Integration/API tests.
-   Build.

Do not claim a check passed if it was not actually run.

### Scope

Do not mark a task complete if it only works by introducing unrequested
later-phase functionality or weakening a locked rule.

### Final completion review

Before finishing, review the implementation against:

1.  The current task requirements.
2.  The relevant PRD section.
3.  This AGENTS.md.
4.  Existing domain rules.
5.  Security and tenant isolation.
6.  Concurrency and retry behavior.
7.  Phase boundaries.

If any required item remains incomplete, state it clearly rather than
hiding it.

------------------------------------------------------------------------

## 7. What Does the Agent Do When Unsure?

Do not guess about critical business behavior.

Use this decision order:

1.  Explicit user instruction.
2.  Current task requirements.
3.  PRD.
4.  AGENTS.md.
5.  Existing approved architecture.
6.  Existing domain rules and tests.
7.  Ask for clarification if the ambiguity materially affects business
    behavior, security, data integrity, or architecture.

### When there is a conflict

Do not silently choose the easiest implementation.

If two requirements genuinely conflict, stop and identify the conflict
before making a destructive architectural decision.

### When a technical choice is not specified

Choose the smallest implementation that:

-   Preserves the locked stack.
-   Preserves PostgreSQL authority.
-   Preserves backend authorization.
-   Preserves tenant isolation.
-   Preserves retry/idempotency behavior.
-   Does not create unnecessary infrastructure.

Do not add a new dependency merely because it is convenient.

### When a later-phase feature seems useful

Do not build it unless the task explicitly includes it.

Create a small extension point only when it does not add unnecessary
complexity and does not change MVP behavior.

### When a provider limitation appears

For Flutterwave, Redis, BullMQ, push/email providers, or AI providers:

-   Isolate provider-specific behavior.
-   Do not weaken Rota's business rules to fit the provider.
-   Persist provider identifiers/events needed for reconciliation.
-   Make retries safe.
-   Surface unsupported behavior rather than silently doing something
    different.

### Final rule

> **When unsure: do less, not more.**
>
> Do not invent scope, guess critical business behavior, bypass
> architecture, weaken security, or add infrastructure without a clear
> requirement.

------------------------------------------------------------------------

## Agent Operating Sequence

For every implementation task:

1.  Read `AGENTS.md`.
2.  Read the relevant PRD section(s).
3.  Identify the current product phase.
4.  List the requirements and acceptance conditions that apply.
5.  Identify the business, security, concurrency, billing, queue, and
    data-integrity rules that apply.
6.  Inspect the existing implementation before changing it.
7.  Implement the smallest complete solution using the locked stack.
8.  Add or update tests for the changed behavior.
9.  Run type checks, lint, tests, and build as applicable.
10. Review the implementation against the PRD and AGENTS.md.
11. Report what changed, what was verified, and any genuinely unresolved
    issue.

Never treat "the app runs" as proof that the task is complete.
