---
name: ai-scheduling-pipeline
description: Safely integrate AI scheduling proposals, conflict explanations, and external AI providers such as DeepSeek or Claude without bypassing Rota's deterministic business rules.
---

# AI Scheduling Pipeline

## Trigger

Use this skill when implementing or modifying:

- AI scheduling proposals
- AI conflict explanations
- AI provider integration

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/ai-pipeline.md`.
4. Read `.agents/rules/scheduling-integrity.md`.
5. Read `.agents/rules/scheduling-conflict-concurrency.md`.
6. Read `.agents/rules/security.md`.
7. Read `.agents/rules/coding-standard.md`.

## Phase

AI is Phase 2.

Do not implement AI scheduling functionality during MVP unless explicitly authorized.

## Provider Architecture

Potential providers include:

- DeepSeek
- Claude
- Other approved providers

AI provider-specific code must remain behind an application-level AI integration boundary.

The scheduling domain must not directly depend on DeepSeek or Claude.

Switching providers must not require rewriting deterministic scheduling logic.

## AI Is Untrusted

AI output is never authoritative.

Never assume AI-generated values are correct for:

- Users
- Teams
- Shifts
- Dates
- Times
- Timezones
- Locations
- Availability
- Permissions
- Billing
- Scheduling state

## No Direct Database Access

AI must never directly:

- Write to PostgreSQL
- Modify shifts
- Modify memberships
- Modify billing
- Change permissions
- Execute unrestricted database queries
- Bypass normal application services

## Structured Output

Prefer structured AI output with explicit schemas.

Validate:

- Required fields
- Data types
- IDs
- Allowed values
- Dates
- Times
- Timezones
- Team ownership
- User ownership
- Requested action

Malformed output must be rejected.

## Scheduling Proposals

An AI-generated schedule is only a proposal.

It must pass:

1. Schema validation
2. Entity resolution
3. Authorization
4. Team/business ownership checks
5. Scheduling rules
6. Conflict checks
7. Current-state validation
8. User confirmation where required
9. Normal application execution
10. Database transaction
11. Audit/outbox processing

## Conflict Explanations

AI may explain scheduling conflicts.

It must not override deterministic conflict detection.

For example, if the database/application determines that two shifts overlap, AI cannot declare the overlap invalid merely because its explanation says otherwise.

## Stale Proposals

An AI proposal may become stale.

Before executing it:

- Re-read current database state.
- Revalidate authorization.
- Revalidate shift state.
- Revalidate conflicts.
- Revalidate relevant versions.

Never execute a previously valid proposal without current-state validation.

## Ambiguity

If an AI request lacks important information:

- Ask for clarification.
- Do not invent critical scheduling assumptions.

## Confirmation

Where an AI proposal changes durable scheduling state, require the appropriate explicit user confirmation before execution.

Confirmation does not replace final backend validation.

## Normal Execution

Once confirmed:

- Execute through the normal scheduling service/API.
- Apply normal authorization.
- Apply normal conflict/concurrency rules.
- Use normal transactions.
- Apply normal idempotency rules where required.
- Create normal notification/outbox work.
- Record appropriate audit information.

AI must not create a separate bypass path.

## Data Minimization

Send only the information required for the AI task.

Do not unnecessarily send:

- Passwords
- Session secrets
- Payment secrets
- API keys
- Unrelated personal information
- Unrelated business data

## Reliability

AI integrations must use:

- Provider timeouts
- Bounded retries
- Rate limits
- Cost controls
- Explicit provider failure handling

Do not create infinite retry loops.

## Testing

Test:

- Valid AI proposal
- Malformed AI output
- Unknown user/team/shift IDs
- Cross-business references
- AI-generated overlap
- Stale AI proposal
- Ambiguous request
- Provider failure
- Provider timeout
- Provider switching
- Explicit confirmation
- Normal transaction execution

## Failure Conditions

The implementation fails if AI can:

- Directly mutate the database
- Bypass authorization
- Create an invalid schedule
- Override deterministic conflict rules
- Execute stale proposals
- Access unnecessary sensitive data
- Become a hard dependency on DeepSeek or Claude

## Core Principle

DeepSeek and Claude are providers.

Rota's deterministic application logic, authorization, PostgreSQL state, scheduling rules, and business rules remain the authority.