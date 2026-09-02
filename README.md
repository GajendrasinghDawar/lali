# Lali

A durable, Pi-powered personal assistant gateway. Accepts messages from Web and Telegram, routes them through a privileged Gateway to an unprivileged Agent, and requires owner approval before executing any external write (email, GitHub PR, etc.).

---

## Architecture

```
                 ╭──────────────╮
   Web Client ──>│   Gateway    │<── Telegram Bot
                 │ (Express.js) │
                 ╰──────┬───────╯
                        │ Unix Socket (Zod-validated protocol v1)
                        v
                 ╭──────────────╮
                 │    Agent     │
                 │  (Pi SDK)    │
                 ╰──────────────╯
```

**Gateway** (`src/gateway/server.ts`) -- Express server. Serves the Web UI, manages auth, persists operational state in SQLite (`gateway.db`), relays messages to the Agent, delivers notifications, and executes approved effects (email, GitHub).

**Agent** (`src/agent/server.ts`) -- Listens on a Unix socket. Validates requests via Zod. Forwards them to the Pi SDK session. Currently uses a deterministic fake model (`src/agent/pi.ts`).

**Web UI** (`src/web/index.html`) -- Chat interface with SSE streaming, effect approval buttons, notification inbox, and email inbox.

**Telegram** (`src/gateway/telegram.ts`) -- Long-polls for owner messages, queues them as durable requests, delivers notifications with inline approve/reject buttons.

---

## Current State

The Agent uses a **fake deterministic model** (`pi.ts`) that echoes input back. It does not call a real LLM. To get real AI responses, you need to replace `PiSession.sendMessage()` with a real model API call (Gemini, Claude, OpenAI, etc.).

Everything else -- Gateway, auth, durable queue, effects, notifications, Telegram, email, GitHub publishing, scheduled jobs, backups -- is wired and functional.

---

## Setup for Real Interaction

### Requirements

- Node.js v22+ (uses `node:sqlite`, `process.loadEnvFile()`, `--experimental-strip-types`)
- A GitHub OAuth App (for Web login)
- A Telegram Bot (for Telegram channel)
- Optional: Resend API key (for email), GitHub PAT (for PR publishing)

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Create a GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set the callback URL to `http://localhost:3000/api/auth/callback/github`
4. Note the **Client ID** and generate a **Client Secret**

### Step 3: Find your GitHub user ID

```bash
curl -s https://api.github.com/users/YOUR_USERNAME | grep '"id"'
```

The numeric `id` field is your `OWNER_GITHUB_ID`. Only this GitHub account can log in.

### Step 4: Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts
3. Copy the **Bot Token**
4. Find your numeric Telegram user ID by messaging [@userinfobot](https://t.me/userinfobot)

### Step 5: Create `.env`

Create a `.env` file in the project root:

```env
# Required: GitHub OAuth (for Web login)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
OWNER_GITHUB_ID=your_numeric_github_id

# Required: Session secret (generate a random string)
BETTER_AUTH_SECRET=some-random-secret-string-at-least-32-chars

# Required: Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-your-bot-token
TELEGRAM_OWNER_ID=your_numeric_telegram_id

# Optional: Email (Resend)
# RESEND_API_KEY=re_...
# EMAIL_FROM=you@yourdomain.com

# Optional: GitHub publishing
# GITHUB_SERVICE_TOKEN=ghp_...

# Optional: Encrypted backups
# BACKUP_PASSPHRASE=your-backup-passphrase
```

### Step 6: Start the system

Run both services together:

```bash
npm run dev
```

Or in separate terminals:

```bash
# Terminal 1 - Agent
npm run dev:agent

# Terminal 2 - Gateway
npm run dev:gateway
```

### Step 7: Test Web interaction

1. Open http://localhost:3000
2. Click "Login with GitHub" -- authenticates via your OAuth app
3. Type a message and press Send
4. You should see the fake agent echo your message back with streaming text
5. Type "fake effect transfer" to trigger an effect proposal -- approve/reject buttons appear

### Step 8: Test Telegram interaction

1. Open your Telegram bot in the Telegram app
2. Send any message
3. The Gateway polls for updates, queues your message, and routes it to the Agent
4. The bot replies with the Agent's response
5. Send "fake effect transfer" to see inline approve/reject buttons

### Step 9: Test cross-channel

1. Send a message from Telegram
2. Open the Web UI -- you can see the same `main` session history
3. Send a message from Web -- Telegram notifications deliver the result

---

## Testing Effects

The fake agent recognizes these trigger phrases:

| Phrase | Effect |
|---|---|
| `fake effect transfer` | Proposes a fake coin transfer effect |
| `send email to user@example.com` | Proposes a `send_email` effect (needs `RESEND_API_KEY`) |
| `publish pr` | Proposes a `publish_pr` effect (needs `GITHUB_SERVICE_TOKEN`) |

When an effect is proposed:
- **Web**: Approve/Reject buttons appear in the chat
- **Telegram**: Inline keyboard buttons appear below the notification

Approving executes the effect. Rejecting discards it. The canonical payload is frozen with a SHA-256 digest at proposal time -- tampering is detected.

---

## Connecting a Real AI Model

The fake model lives in `src/agent/pi.ts`. To use a real model, replace `PiSession.sendMessage()` with an API call. Example sketch for Gemini:

```typescript
// In src/agent/pi.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class PiSession extends EventEmitter {
  async sendMessage(message: string) {
    this.emit("lifecycle", "start_thinking");

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: message,
    });

    this.emit("lifecycle", "start_streaming");
    let full = "";
    for await (const chunk of response) {
      const text = chunk.text();
      if (text) {
        full += text;
        this.emit("text", text);
      }
    }

    this.emit("lifecycle", "done_streaming");
    return { type: "text", text: full };
  }
}
```

Add `GEMINI_API_KEY=...` to your `.env` and `npm install @google/genai`.

---

## Running Tests

```bash
npm run typecheck   # TypeScript type checking
npm run test        # Vitest unit/integration tests
```

---

## Production Deployment

See [docs/production-guide.md](docs/production-guide.md) for:
- Accepted Agent risk profile
- Secret rotation procedures
- Branch protection expectations
- Self-deployment prohibition
- Backup/restore with `scripts/backup.sh` and `scripts/restore.sh`

See [docs/e2e-checklist.md](docs/e2e-checklist.md) for the release verification checklist.
