---
name: auth-account-lifecycle
description: Handle Rota signup, login, email verification, logout, sessions, password reset, and login throttling according to the authentication and security rules.
---

# Auth Account Lifecycle

## Trigger

Use this skill when implementing or modifying:

- Signup
- Login
- Email verification
- Logout
- Sessions
- Password reset
- Login throttling

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/security.md`.
4. Read `.agents/rules/coding-standard.md`.
5. Read relevant database rules in `.agents/rules/database-schema.md`.

Do not invent authentication behavior that conflicts with those sources.

## Required Behavior

### Signup

- Validate all signup input on the server.
- Enforce unique email addresses.
- Use Argon2id for password hashing.
- Signup must not create duplicate accounts when the request is retried.
- Apply signup rate limiting.
- Do not expose unnecessary information about whether an account already exists.

### Login

- Validate credentials on the server.
- Never trust client-provided authorization information.
- Apply login rate limiting and progressive throttling.
- Failed login attempts must be handled without creating an account-enumeration vulnerability.
- Do not reveal whether a specific email exists.
- Never log passwords or authentication secrets.

### Sessions

- Sessions are server-controlled.
- Sessions must be revocable.
- Use secure session configuration appropriate to the environment.
- Logout must invalidate/revoke the relevant session.
- Protected requests must resolve the authenticated user before accessing business data.

### Email Verification

- Verification secrets/codes must expire.
- Verification secrets/codes must be single-use.
- Store secrets safely.
- Apply resend cooldown/rate limiting.
- Do not allow an expired or already-used verification secret to succeed.

### Password Reset

- Reset secrets/tokens must expire.
- Reset secrets/tokens must be single-use.
- Apply password-reset rate limiting.
- Do not reveal whether an account exists.
- Resetting a password must invalidate/revoke sessions according to the established authentication rules.

### Authorization Boundary

Authentication only establishes identity.

It does not automatically grant access to a Business or Team.

Every business/team operation must separately verify:

- Business membership
- Team membership
- Role
- Required permission

## Security Requirements

Never log or expose:

- Passwords
- Session secrets
- Password reset tokens
- Verification codes
- API keys
- Provider credentials

Return safe API errors without exposing internal implementation details.

## API Behavior

Use the project's standard API envelopes:

Success:

`{ data, meta }`

Error:

`{ error: { code, message, details } }`

Use `/api/v1` routes.

## Testing

Test at minimum:

- Successful signup
- Duplicate signup
- Successful login
- Failed login
- Progressive login throttling
- Email verification
- Expired verification
- Reused verification
- Password reset
- Expired reset token
- Reused reset token
- Logout/session revocation
- Cross-business authorization attempts

## Failure Conditions

This skill is incomplete if authentication allows:

- Duplicate accounts
- Reusable verification/reset secrets
- Unrevocable sessions
- Authentication bypass
- Account enumeration through sensitive responses
- Unlimited login abuse
- Unauthorized access to business/team data