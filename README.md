# Lali

A personal AI assistant agent you talk to over Telegram. Runs on a server, accepts commands, reads and writes files, remembers things across
sessions, and checks in on you with scheduled briefings.

Based on OpenClaw architecture, but minimal and hackable.

---

## What it does

- **Chat over Telegram.** Message the bot, get answers. Sessions are per-user and
  persisted to disk.
- **Agentic tool use.** Lali runs a real agent loop: the model can call tools,
  see the results, and keep going until the task is done.
- **Runs commands & touches files.** `run_command`, `read_file`, `write_file` give
  it hands on your machine — gated by a permissions layer.
- **Long-term memory.** It writes durable notes to `./memory/*.md` and searches
  them to recall context across conversations.
- **Context compaction.** When a conversation gets long, older history is
  summarized automatically so it never blows past the model's context window.
- **Multiple personalities.** Route to specialist agents (e.g. a research agent)
  with prefix commands like `/research`.
- **Scheduled heartbeats.** Recurring autonomous tasks (e.g. a 07:30 morning
  briefing) run on their own isolated sessions.
- **HTTP API.** A small Flask endpoint (`POST /chat`) lets you talk to the same
  agent without Telegram.

---

## Architecture

```diagram
                 ╭──────────────╮        ╭──────────────╮
   Telegram ────▶│   main.py    │        │  schedular   │
   user msg      │ handle_message│◀──────│ (heartbeats) │
                 ╰──────┬───────╯        ╰──────┬───────╯
   HTTP POST           │                        │
   /chat ─────────────▶│                        │
                       ▼                        ▼
                 ╭───────────────────────────────────╮
                 │           agent.py                 │
                 │      run_agent_turn() loop         │
                 │  model ⇄ tool calls until done     │
                 ╰───┬───────────────┬───────────┬────╯
                     │               │           │
              ╭──────▼─────╮  ╭──────▼─────╮  ╭──▼─────────╮
              │  ai_client │  │  tools.py  │  │ compaction │
              │ (Azure     │  │ run_command│  │ summarize  │
              │  OpenAI)   │  │ read/write │  │ old history│
              ╰────────────╯  │ memory     │  ╰────────────╯
                              │ web_search │
                              ╰─────┬──────╯
                                    │
                            ╭───────▼────────╮
                            │ permissions.py │
                            │ command safety │
                            ╰────────────────╯

   Persistence:  ./sessions/*.jsonl   ./memory/*.md   ./exec-approvals.json
```

### File map

| File             | Responsibility                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `main.py`        | Entry point. Wires up Telegram polling + Flask, routes messages, holds per-session locks.                                          |
| `agent.py`       | The core agent loop — calls the model, executes tool calls, repeats until no more tools are requested.                             |
| `ai_client.py`   | Azure OpenAI client setup (reads creds from env).                                                                                  |
| `tools.py`       | Tool definitions + their implementations (`run_command`, `read_file`, `write_file`, `web_search`, `save_memory`, `memory_search`). |
| `permissions.py` | Command safety classification: `safe` / `approved` / `needs_approval`.                                                             |
| `multi_agent.py` | Agent registry + message routing (`/research` etc.).                                                                               |
| `compaction.py`  | Summarizes old history when a session grows too large.                                                                             |
| `schedular.py`   | Recurring "heartbeat" tasks via the `schedule` library.                                                                            |
| `utils.py`       | Session load/save (JSONL) + cleaning items for the Responses API.                                                                  |
| `contants.py`    | The `SOUL` system prompt — Lali's identity and rules.                                                                              |

### Persistence

- `./sessions/<user_id>.jsonl` — one message per line, the full conversation history.
- `./memory/<key>.md` — long-term memory notes, written and searched by the agent.
- `./exec-approvals.json` — allow/deny list for shell commands.

---

## The agent loop

The heart of Lali is [`run_agent_turn`](agent.py). Each turn:

1. Send the conversation + tool definitions to the model.
2. Append whatever the model emits (text and/or tool calls) to history.
3. If there are no tool calls → return the text. Done.
4. Otherwise → execute every requested tool, append the outputs, and loop.

This is what makes it _agentic_ rather than a one-shot chatbot: it can chain many tool calls within a single user turn.

---

## Setup

### Requirements

- Python **3.14+**
- An [Azure OpenAI](https://azure.microsoft.com/products/ai-services/openai-service)
  deployment
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Install

This project uses [uv](https://github.com/astral-sh/uv):

```bash
uv sync
```

### Configure

Create a `.env` file in the project root:

```env
AZURE_API_KEY=your-azure-openai-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

> The Azure endpoint and API version are currently hard-coded in
> [`ai_client.py`](ai_client.py) — update them there to point at your own deployment.

### Run

```bash
uv run main.py
```

On startup Lali will:

- start the Flask API on `http://localhost:5000`,
- register the scheduled heartbeats,
- begin polling Telegram for messages.

---

## Usage

### Telegram

Just message your bot. To talk to a specialist agent, prefix your message:

```
/research what's the latest on small language models?
```

### HTTP

```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "me", "message": "what files are in this folder?"}'
```

---

## Permissions & safety

Lali can run shell commands, so command execution is gated by
[`permissions.py`](permissions.py):

- **Safe commands** (`ls`, `cat`, `head`, `tail`, `wc`, `date`, `whoami`, `echo`)
  run immediately.
- **Previously approved** commands (in `exec-approvals.json`) run.
- **Everything else** — and anything matching dangerous patterns like `rm`,
  `sudo`, `chmod`, or piping `curl` into a shell — returns
  `needs_approval` and is blocked.

> ⚠️ This is a personal-use tool that gives an LLM the ability to run code and
> edit files on your machine. Run it somewhere you trust, review the permission
> rules, and don't expose the Flask endpoint to the open internet. I'll add auth later, so I can securely access it across different channels — web, Telegram, WhatsApp, and so on.

---

## Customizing

- **Personality:** edit `SOUL` in [`contants.py`](contants.py).
- **Add a tool:** add a definition to `TOOLS` and a branch in `execute_tool`
  in [`tools.py`](tools.py).
- **Add an agent:** add an entry to `AGENTS` and a route in `resolve_agent`
  in [`multi_agent.py`](multi_agent.py).
- **Add a scheduled task:** register it in `setup_heartbeats` in
  [`schedular.py`](schedular.py).

---

## Roadmap / known gaps

- **Port to TypeScript / Node.js** — rewrite the agent loop and tooling for the Node ecosystem.
- **Use [pi](https://pi.dev/) as the core coding agent** — lean on pi for the agentic harness.
- **Add an LLM wiki** — a self-maintained knowledge base inspired by Andrej Karpathy's [wiki patterns](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
