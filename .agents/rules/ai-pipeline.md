---
trigger: glob
---

# AI Pipeline Rules

## Phase

- AI is a Phase 2 capability.
- Do not implement AI functionality during MVP unless explicitly authorized.

## Provider Independence

Supported providers may include:

- DeepSeek
- Claude
- Other approved providers

Providers must sit behind an application-level AI integration boundary.

The scheduling/business domain must not depend directly on DeepSeek or Claude.

Switching providers must not require rewriting core scheduling logic.

## AI Is Untrusted

AI output is never authoritative.

Never assume AI-generated:

- Users
- Teams
- Shifts
- Times
- Locations
- Permissions
- Prices
- Billing state
- Statuses

are correct.

## No Direct Database Access

AI must not directly:

- Write to PostgreSQL
- Modify scheduling records
- Modify billing
- Modify permissions
- Bypass API authorization
- Execute unrestricted database queries

## Structured Output

Prefer structured AI output with explicit schemas.

Validate:

- Types
- Required fields
- Allowed values
- IDs
- Dates/times
- Timezones
- Business/team ownership
- Requested actions

Reject malformed output.

## Normal Business Validation

After AI generates a proposal:

1. Validate the structure.
2. Resolve referenced entities.
3. Check authorization.
4. Check scheduling/business rules.
5. Check conflicts.
6. Present for explicit confirmation when required.
7. Revalidate current database state.
8. Execute through the normal application service/API.
9. Use the appropriate transaction.
10. Audit the resulting change.
11. Trigger normal notification/outbox behavior.

AI must never bypass these steps.

## Stale Proposals

An AI proposal may become stale.

Before execution, re-read current database state and revalidate it.

Never execute an old proposal simply because it was previously valid.

## Ambiguity

If a request is ambiguous, AI should ask for clarification rather than inventing important scheduling or business details.

## Data Minimization

Send only the data required for the AI task.

Do not unnecessarily send secrets or unrelated business/user information to AI providers.

## Reliability

- Bound AI provider retries.
- Use timeouts.
- Handle provider failures explicitly.
- Do not create infinite retry loops.
- Respect rate and cost limits.

## Audit

AI-assisted actions must be traceable where appropriate.

Record enough information to understand that an AI-assisted operation occurred without storing unnecessary sensitive provider payloads.

## Core Principle

DeepSeek and Claude are providers.

Rota's deterministic application logic, authorization, database rules, and business rules remain the authority.