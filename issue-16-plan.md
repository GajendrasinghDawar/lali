# Technical Specification for Issue #16 (Harden recovery, retention, backups, release proof)

This document outlines the implementation plan for hardening Lali's operations and state management.

## 1. Versioned Transactional Migrations
**Problem:** Scattered `CREATE TABLE IF NOT EXISTS` across `queue.ts`, `telegram.ts`, `artifacts.ts`, `effects.ts`, etc.
**Solution:**
- Create a `schema_migrations` table to track applied versions.
- Centralize schema initialization in `src/gateway/schema.ts`.
- Move existing schema definitions into a `src/gateway/migrations/` directory (e.g. `001_initial_schema.ts` or `.sql`).
- During startup, run unapplied migrations sequentially within a transaction instead of doing scattered table creation.

## 2. Startup Cleanup Module
**Problem:** Need to expire stale sessions/proposals and accurately mark interrupted work during boot.
**Solution:**
- Create `src/gateway/startup_cleanup.ts`.
- Hook this into `src/gateway/server.ts` right after database connection.
- Clean up any stale sessions in `session_state` and proposals.
- Ensure any `requests` left in `running` state from a crashed process are transitioned to an interrupted or failed state cleanly.

## 3. Retention and Data Pruning
**Problem:** Temporary data and operational projections grow unbounded in SQLite.
**Solution:**
- Enhance `src/gateway/scheduled_jobs.ts` or add a new interval/cron module.
- Add queries to prune old records (e.g., keeping only 30 days of history):
  - `DELETE FROM requests WHERE status IN ('completed', 'failed') AND created_at < datetime('now', '-30 days');`
  - Prune old `events`, `effects`, `notifications`, and `inbound_emails`.

## 4. Structured Production Logs
**Problem:** Unstructured `console.log` can leak PII and secrets.
**Solution:**
- Create `src/shared/logger.ts`.
- Implement a structured JSON logger wrapper around `console.log`/`console.error`.
- Include a sanitizer that scrubs known sensitive keys (e.g., `token`, `secret`, `password`, `authorization`, `api_key`).
- Replace bare `console.log` and `console.error` calls throughout the Gateway and Agent codebases with this logger.

## 5. Encrypted Backups and Restores
**Problem:** Need a secure way to backup the operational `data/` directory.
**Solution:**
- Create `scripts/backup.sh`: Tar and zip the `data/` directory (including `gateway.db`), then pipe it through OpenSSL to encrypt it (e.g., `openssl enc -aes-256-cbc`).
- Create `scripts/restore.sh`: Decrypt and extract the backup archive into `data/`.
- Ensure `.env` is documented to provide the `BACKUP_PASSPHRASE`.

## 6. Production Documentation
**Problem:** Required guidelines and risk disclosures are missing.
**Solution:**
- Create `docs/production-guide.md`.
- Document:
  - The accepted "unrestricted-Agent" risk profile.
  - Procedures for secret and key rotation (e.g., Telegram bots, webhooks).
  - Branch protection expectations for GitHub.
  - The explicit self-deployment prohibition policy.
- Update `README.md` to link to this new production guide.

## 7. End-to-End Release Proof
**Problem:** Need verifiable proof that release processes are sound.
**Solution:**
- Create `docs/e2e-checklist.md`.
- Detail the manual test procedure and automated sanity checks for:
  - Clean startup & migration execution.
  - State recovery after abrupt kill.
  - Correct masking of secrets in stdout logs.
  - Successful backup dump and restore loop.
