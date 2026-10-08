---
trigger: always_on
---

# Database Schema Rules

## Source of Truth

- PostgreSQL is Rota's durable source of truth.
- Redis is only for caching, rate limiting, distributed locks, and BullMQ infrastructure.
- Never rely on Redis for permanent business data.

## Ownership Hierarchy

The core ownership structure is:

Business
→ Team
→ TeamMembership
→ User

- Business is the billing boundary.
- Team is the scheduling and authorization boundary.
- TeamMembership defines a user's role within a team.
- A user may belong to multiple teams with different roles.

## Roles

Supported roles:

- OWNER
- MANAGER
- STAFF

Role permissions must be scoped to the relevant team.

## Tenant Isolation

- Every business-owned record must be traceable to its business/team ownership.
- Queries must always enforce tenant/team boundaries.
- Never allow an authenticated user to access another business's data.

## Relationships

- Use foreign keys for required relationships.
- Define deletion behavior intentionally.
- Do not cascade-delete historical scheduling, billing, audit, or other records that must survive deactivation.

## Uniqueness

Database constraints must enforce important uniqueness requirements, including where applicable:

- Unique user email
- Unique team membership per user/team
- Unique provider webhook event ID
- Unique idempotency key within its required scope

## Scheduling Data

- Store actual shift start/end timestamps.
- Preserve the team's/location's IANA timezone.
- Do not use display-formatted dates as authoritative scheduling data.
- Prevent invalid start/end ranges.
- Prevent overlapping active shifts where required.
- Use database constraints, transactions, and locking where necessary to prevent concurrent conflicting writes.

Overlap condition:

`existing.start < new.end AND existing.end > new.start`

## Shift Lifecycle

Use explicit lifecycle states rather than deleting meaningful scheduling history.

Core states:

- DRAFT
- PUBLISHED
- CANCELLED
- COMPLETED

Published/cancelled/historical records must remain available for history and audit purposes.

## Recurring Shifts

Keep the recurrence definition separate from generated/actual shift instances when required.

Editing a recurrence must not silently corrupt existing historical instances.

## Concurrency

Use optimistic concurrency/version checks where stale client updates could overwrite newer changes.

Critical concurrent operations must be protected transactionally.

## Billing

- Billing belongs to the Business.
- Store monetary values as integer smallest currency units.
- Keep provider-specific identifiers separate from internal billing state.
- Persist provider webhook/event IDs for deduplication.
- Billing history must survive account/business state changes.

## Idempotency

Persist idempotency information for retry-sensitive mutations where required.

The same key + same request should return the original result.

The same key + different request must be rejected as a conflict.

## Audit

Audit records should preserve, where applicable:

- Actor
- Business
- Team
- Action
- Entity
- Before state
- After state
- Request/correlation ID
- Timestamp

Never store secrets in audit records.

## Migrations

- Every schema change must have a migration.
- Never silently modify production schema outside the migration process.
- Review migrations for destructive or irreversible changes.
- Test important constraints and migrations.
