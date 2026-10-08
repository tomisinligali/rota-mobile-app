---
trigger: always_on
---

# Git Conventions

## Commits

- Keep commits focused on one logical change.
- Use clear commit messages describing the actual change.
- Do not combine unrelated refactors with feature work.
- Business-rule changes should be obvious from the commit history.

## Schema Changes

- Database schema changes must include the appropriate migration.
- Do not commit application code that depends on an uncommitted schema change.

## Tests

When changing critical business behavior:

- Update or add relevant tests.
- Do not remove tests simply because they expose a bug in the implementation.

## Locked Architecture

Do not casually replace:

- Express
- PostgreSQL
- Redis
- BullMQ
- Flutterwave
- React Native
- Expo

Architectural changes require explicit authorization.

## Secrets

Never commit:

- Passwords
- API keys
- Session secrets
- Flutterwave secrets
- AI provider keys
- Notification provider secrets
- `.env` files containing real credentials

## Generated Files

Follow project instructions for generated files.
Do not manually modify generated artifacts when the source file is the intended source of truth.

## Before Committing

Check:

- TypeScript/build
- Tests
- Lint/formatting where configured
- Database migrations
- No secrets
- No accidental unrelated files

## History

- Avoid rewriting shared history.
- Do not force-push unless explicitly required and safe.
- Do not delete useful project history to hide implementation mistakes.

## Scope

Do not mix unrelated cleanup, dependency changes, or formatting changes into a feature commit unless required.