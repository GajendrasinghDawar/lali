# Debugging Report: Chat Queue & Gateway Issues

This document summarizes the root causes and solutions for the series of bugs that prevented the chat interface and gateway server from functioning correctly.

## 1. Chat Queue Permanently Stuck in `running`

**Symptoms:** Messages sent from the frontend did not receive a response. Database inspection revealed requests were permanently stuck in the `running` state, blocking all subsequent queued requests.

**Root Cause A: TCP Stream Chunking Bug (The "Silent Drop")**
When the agent sent JSON messages over the named pipe (`\\.\pipe\lali-agent`), the gateway server read the data in chunks. The parsing logic in `src/gateway/application/queue.ts` incorrectly used `buffer.split("\\n")` (a literal backslash followed by 'n') instead of the actual newline character `buffer.split("\n")`. 
Because TCP data arrives in arbitrary chunks, this caused the gateway to attempt to `JSON.parse` incomplete fragments of the JSON payload. The gateway swallowed the resulting syntax errors and dropped the messages—crucially dropping the final `{"type": "done"}` event. Without this event, the gateway never marked the request as `completed` in the database.
* **Solution:** Corrected the delimiter to `\n` in `src/gateway/application/queue.ts`, ensuring complete JSON objects are reconstructed before parsing.

**Root Cause B: Stale Shell Environment Variables**
The agent process in `src/agent/pi.ts` used `process.loadEnvFile()` to load configuration. However, Node's `loadEnvFile()` does not overwrite environment variables that are already exported in the active shell. The shell running the server had a stale `AZURE_OPENAI_BASE_URL` (`https://gajen-m8ujm03o-swedencentral...`) lingering in its memory, which overrode the correct Serverless endpoint (`https://princ-msg6fgey-southeastasia...`) defined in `.env`.
* **Solution:** Implemented a custom `.env` parser in `pi.ts` using `fs.readFileSync` and a regex matcher. This guarantees that the exact values in the `.env` file are treated as the source of truth, bypassing any stale shell variables.

**Root Cause C: Azure OpenAI Provider Mismatch**
The Azure Serverless endpoint provided was designed to be a drop-in replacement for the standard OpenAI API (expecting routes like `/chat/completions`). The `pi-ai` library was configured to use the `azure-openai-responses` provider, which automatically appended legacy Azure-specific routes (`/openai/deployments/...`). This resulted in `404 Not Found` and `401 Unauthorized` errors from Azure.
* **Solution:** Switched the `pi-ai` model provider to `openai` and bound the `baseUrl` directly to the model configuration, mirroring standard OpenAI SDK behavior.

## 2. Gateway Server Crashing on Restart

**Symptoms:** Starting or restarting the gateway server (`src/gateway/http/server.ts`) caused a fatal crash in `src/gateway/persistence/startup_cleanup.ts`: `Error: NOT NULL constraint failed: session_state.userId`.

**Root Cause:**
On startup, the server attempts to find any interrupted requests and mark their associated sessions as paused. It did this using an `INSERT INTO session_state ... ON CONFLICT DO UPDATE` query. However, the `session_state` table enforces a `NOT NULL` constraint on the `userId` column. In SQLite, the `INSERT` portion of an `ON CONFLICT` clause is evaluated first. Since `userId` was omitted from the query, the constraint failed before the `ON CONFLICT` fallback could trigger.
* **Solution:** Replaced the flawed `INSERT ... ON CONFLICT` statement with a standard `UPDATE session_state SET is_paused = 1 WHERE sessionId = ?` query in both `startup_cleanup.ts` and `queue.ts`.

## 3. Email UI Errors

**Symptoms:** Clicking the "Check Mail" or "Inbox" buttons in the frontend did nothing, throwing `ReferenceError: checkEmails is not defined` in the browser console. After implementing the functions, it threw `TypeError: emails is not iterable`.

**Root Cause:**
1. The HTML buttons were wired to `onclick="checkEmails()"` but the Javascript implementations were entirely missing.
2. The `/api/emails` endpoint returns data wrapped in an object (`{ emails: [...] }`), but the frontend attempted to iterate over the object directly as an array. Furthermore, it referenced nonexistent database columns (`from_name`, `preview`) instead of the correct ones (`sender`, `received_at`).
* **Solution:** Added the `checkEmails` and `loadEmails` implementations to `src/web/index.html`. Updated the payload parsing to extract the `emails` array correctly and mapped the DOM elements to the correct SQLite columns.
