---
name: business-team-membership-lifecycle
description: Handle Rota business and team creation, invitations, memberships, role changes, and staff deactivation while enforcing tenant isolation and authorization.
---

# Business Team Membership Lifecycle

## Trigger

Use this skill when implementing or modifying:

- Business creation
- Team creation
- Invitations
- Membership changes
- Role changes
- Staff deactivation

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/database-schema.md`.
4. Read `.agents/rules/security.md`.
5. Read `.agents/rules/money-billing.md`.
6. Read `.agents/rules/coding-standard.md`.

## Domain Boundaries

Rota uses these boundaries:

- Business = billing boundary
- Team = scheduling/authorization boundary
- TeamMembership = role/access boundary
- User = account identity

A user may belong to multiple teams with different roles.

Supported roles:

- OWNER
- MANAGER
- STAFF

MVP has one owner per Business.

## Business Creation

When creating a Business:

- Authenticate the creator.
- Create the business and required initial ownership/membership atomically.
- The creator becomes the appropriate owner.
- Do not leave a partially created business.
- Preserve billing/trial state required by the PRD.

## Team Creation

When creating a Team:

- Verify the actor's Business authorization.
- Associate the Team with the correct Business.
- Never accept an arbitrary Business ID as proof of authorization.
- Preserve the Business → Team ownership relationship.

## Invitations

Invitations must:

- Belong to the correct Business/Team.
- Be created only by an authorized actor.
- Expire according to the defined lifecycle.
- Not grant access until the invitation is legitimately accepted.
- Prevent unauthorized cross-business/team invitations.

## Membership

Membership operations must verify:

- Authenticated user
- Business
- Team
- Existing membership
- Actor's role
- Requested target role/change

Enforce unique membership per user/team at the database level.

## Role Changes

- Role changes require appropriate authorization.
- Never trust a client-provided role.
- A role applies to the relevant TeamMembership only.
- Changing a user's role in one team must not silently change their role in another team.
- Do not allow role changes to bypass tenant isolation.

## Staff Deactivation

Deactivation must:

- Prevent future access/actions according to the product rules.
- Preserve historical scheduling records.
- Preserve audit history.
- Not silently delete shifts or historical assignments.
- Recalculate authoritative billable-seat state where required.

## Billing Interaction

Because Business is the billing boundary:

- Seat counts must come from authoritative membership state.
- Do not trust client-provided staff counts.
- OWNER/MANAGER are non-billable by default.
- STAFF are billable by default.

## Transactions

Use transactions when multiple related records must change atomically.

Examples:

- Business creation + initial owner membership
- Invitation acceptance + membership creation
- Membership changes affecting related state

## Testing

Test:

- Business creation
- Team creation
- Invitation authorization
- Invitation expiry
- Duplicate memberships
- Role changes
- Cross-business access
- Staff deactivation
- Historical data preservation
- Seat-count correctness

## Failure Conditions

The implementation fails if:

- A user modifies another Business's membership.
- An unauthorized user changes roles.
- Duplicate memberships can exist.
- Deactivated staff retain unauthorized access.
- Historical scheduling data is deleted.
- Billing seat calculations use untrusted client data.