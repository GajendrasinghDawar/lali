# Lali E2E Release Proof Checklist

This checklist acts as a verifiable proof of whole-system recovery, authority invariants, and operational behavior. It must be manually executed and signed off prior to tagging a major release.

## 1. Clean Startup & Migrations
- [ ] Spin up a clean Gateway instance with an empty `data/` directory.
- [ ] Verify `schema_migrations` table is created and populated up to the latest version.
- [ ] Verify all required tables (`requests`, `events`, `session_state`, `artifacts`, `effects`, `inbound_emails`, `notifications`, `scheduled_jobs`, `telegram_state`) are initialized without errors.

## 2. State Recovery After Abrupt Kill
- [ ] Start an ongoing chat session that takes several seconds to complete (e.g. ask for a complex summary).
- [ ] Kill the Gateway process abruptly (`kill -9`).
- [ ] Restart the Gateway.
- [ ] Verify that the interrupted request's status is changed from `running` to `interrupted`.
- [ ] Verify the session is marked as `is_paused = 1`.

## 3. Masking of Secrets in Logs
- [ ] Send a message containing a fake secret key to the Agent.
- [ ] Observe the Gateway standard output.
- [ ] Verify that no `console.log` lines leak the API keys, session secrets, or raw prompt bodies containing the test secret. 

## 4. Encrypted Backup Dump and Restore Loop
- [ ] Create test data: Start a session, emit a message, configure a scheduled job.
- [ ] Run `export BACKUP_PASSPHRASE=test1234` and `./scripts/backup.sh`.
- [ ] Verify `backups/lali-data-*.tar.gz.enc` is created.
- [ ] Delete `data/gateway.db` and the whole `data/` directory.
- [ ] Run `./scripts/restore.sh backups/lali-data-*.tar.gz.enc`.
- [ ] Start Gateway and verify test data (session, messages, jobs) is restored intact.

## 5. Channel End-to-End Functionality
- [ ] **Web Access**: Login via Better Auth and execute a basic query.
- [ ] **Telegram Access**: Send a Telegram message via the configured bot, verify response queueing and receipt.
- [ ] **Shared Main Context**: Both Web and Telegram can converse in the same `main` session.
- [ ] **Approvals**: Agent proposes an effect (e.g. `run_command`); verify approval buttons work in both Web UI and Telegram inline keyboard.
- [ ] **GitHub Publication**: Agent creates a PR. Verify correct validation of branch/commit identity.
- [ ] **Email Intake/Send**: Agent generates a `send_email` effect. Verify approval sends mail via Resend.
- [ ] **Scheduled Jobs**: Configure a scheduled job. Verify it executes at the expected interval, creates an isolated session, and routes completions to the notification manager.

## 6. Credential Isolation Proof
- [ ] Intercept or dump the exact environment variables injected into the Agent process.
- [ ] Verify `GITHUB_TOKEN`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `BETTER_AUTH_SECRET` are strictly absent.
- [ ] Verify that Agent websocket protocol frames only contain instructions, proposals, and content - no secrets.
