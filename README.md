# Lali

A minimal, hackable AI assistant agent.

Based on OpenClaw architecture, now rewritten in TypeScript.

---

## What it does

- **Chat over Web UI.** Message the bot and stream responses in real-time.
- **Agentic tool use.** The system is set up to run an agent loop powered by a Pi SDK main session.
- **Durable State.** Gateway uses temporary SQLite state to track operational status, while Pi owns the transcript.

---

## Architecture

```diagram
                 ╭──────────────╮
    Web Client ─▶│   Gateway    │
                 │ (Express.js) │
                 ╰──────┬───────╯
                        │ Unix Socket (Zod validated)
                        ▼
                 ╭──────────────╮
                 │    Agent     │
                 │  (Pi SDK)    │
                 ╰──────────────╯
```

### Components

- **Gateway** (`src/gateway/server.ts`): Express server that serves the Web UI, receives HTTP messages, commits operational state to a local `gateway.db` SQLite database, and relays messages to the Agent via a Unix socket.
- **Agent** (`src/agent/server.ts`): Listens on a Unix socket, validates incoming requests using `zod`, and forwards them to the Pi SDK.
- **Pi SDK Mock** (`src/agent/pi.ts`): A deterministic fake model that simulates thinking and streams sequenced text/lifecycle events.
- **Protocol** (`src/shared/protocol.ts`): Zod schemas for socket messages.
- **Web UI** (`src/web/index.html`): Simple chat interface that uses SSE to display streamed text.

---

## Setup

### Requirements

- Node.js 20+

### Install

```bash
npm install
```

### Run

You can run both Gateway and Agent concurrently using:

```bash
npm run dev
```

Alternatively, run them in separate terminals:

```bash
# Terminal 1
npm run dev:agent

# Terminal 2
npm run dev:gateway
```

Once running, navigate to `http://localhost:3000` to interact with Lali.
