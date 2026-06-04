# Patterns to grow Lali into (from `nano-agent-ts`)

A distilled, build-when-you-need-it reference. Source:
[`nano-agent-ts/mini-openclaw`](file:///C:/Users/dawar/projects/nano-agent-ts) —
the more mature sibling of Lali. Same DNA (Telegram coding agent, tool loop,
sessions, approvals, heartbeats); it's simply further along.

> Adopt a pattern only when the matching pain appears. Keeping Lali small *is*
> the most important lesson here.

---

## The guiding principle

Everything below serves one idea: **a simple, legible core with complexity
pushed to the layers above it.**

- Clearly defined problems, compact API surface, tight constraints.
- Clear module boundaries; known conventions; no hidden magic.
- The agent loop should depend on *interfaces* (session store, approvals,
  delivery), not on concrete file/transport details.

---

## Patterns, by theme

Each entry: **what it is → why it helps → the smallest first step.**

### A. Structure & wiring

**1. A single composition root (`runtime.py`)**
One place builds and wires everything (client, agents, stores, queues,
scheduler) and returns one `Runtime` object. `main.py` shrinks to: load config →
`build_runtime()` → register handlers → run.
*First step:* create a `Runtime` dataclass holding `client`, `session_store`,
`agents`; move wiring out of `main.py`.

**2. Config in one place (`config.py`)**
Pull every magic value into one config loaded at startup: compaction threshold
(`100_000`), shell timeout (`30s`), `MEMORY_DIR`, `SESSIONS_DIR`, model name,
max tokens. Also rename `contants.py` → `constants.py`.
*First step:* a `config.py` with module-level constants; import from there.

**3. Session store as an interface**
Wrap the JSONL functions in a `SessionStore` class (`load`, `append`, `save`,
`list`) and inject it via `Runtime`. A future SQLite backend becomes a one-line
swap instead of a rewrite.
*First step:* class-wrap the existing functions in `utils.py`; no behavior change.

### B. The agent loop

**4. The loop owns compaction (not the transport)**
Today compaction runs in the Telegram handler with a magic constant and writes
to disk as a side effect. Move it inside `run_agent_turn`, drive it from config,
and have `compact_session` *return* the new list instead of saving — let the
caller persist. (Single responsibility: compaction shouldn't know the on-disk
format.)

**5. Structured tool results**
Tools currently return ad-hoc strings (`"exit=0\n..."`, `"Wrote to ..."`). Return
a predictable envelope instead — `{ ok, output, error, meta }` — then
JSON-stringify for `function_call_output`. The model handles failures far more
reliably when they're explicit, not buried in text.

**6. A step budget**
Cap tool-call iterations per turn (nano-agent uses ~20) so a misbehaving model
can't loop forever. Return a graceful "couldn't finish in step budget" message.

### C. Safety & tools

**7. A real approval queue** *(highest-value UX upgrade)*
Today `needs_approval` just refuses — the user can't approve a one-off command.
Build an `ApprovalQueue`: each request has an id, expiry, and status; persisted
so it survives restart. Telegram commands `/approvals`, `/approve <id>`,
`/deny <id>`. When `check_command_safety` returns `needs_approval`, the tool call
*awaits* a decision (timeout → auto-deny) instead of failing.

**8. A uniform tool gate**
A single `tool_gate(name, args)` runs in front of every tool call to apply
approval policy and a read-only mode — instead of each tool checking for itself.

**9. Tool layer split (contracts vs. implementations)**
Keep schemas in one registry; move implementations into families (`tools_fs`,
`tools_shell`, `tools_memory`, `tools_web`) when any one gets non-trivial. Turn
the `if/elif` in `execute_tool` into a dispatch table.

### D. Reliability & delivery

**10. Durable outbound delivery queue**
Replies are sent inline; a crash between LLM completion and reply loses the
answer. Write each outbound message to disk first, then a runner sends with
retry/backoff. Gives at-least-once delivery, crash recovery, and one central
place to add Telegram's 4096-char chunking and rate limiting.

**11. Retry with backoff + jitter**
No retry today around the LLM call or the Telegram send — one transient 429 kills
a turn. Add a `with_retry(fn, attempts, schedule, should_retry)` helper; wrap the
LLM call and sends. Don't retry on `401`/`403`.

**12. Per-session FIFO lane**
Replace the duplicated `defaultdict(threading.Lock)` (in both `main.py` and
`schedular.py`) with one shared `SessionLane` keyed by session, exposing
`enqueue`, `depth`, and a `max_queue_depth` so a fast user can be told to slow
down. Share it across Telegram, Flask, and the scheduler.

### E. Operations

**13. Heartbeats reuse the real loop**
The scheduler has its own locks and only `print()`s — the user never sees the
morning briefing. Route scheduled turns through the same loop, the same session
lane, and the same delivery queue so they actually reach Telegram.

**14. Webhook ingress (when deploying)**
Long-polling + a separate Flask server = two transports. Switch to webhook mode
and let one HTTP server own `/health`, `/chat`, `/telegram/webhook`, gated by a
`TELEGRAM_WEBHOOK_SECRET`.

**15. Background tasks (only if needed)**
`run_command` is synchronous with a 30s cap — no builds or servers. If that
becomes a need: a `BackgroundTaskManager` with `start/check/list/kill` and
bounded output capture, exposed as tools.

---

## Build order (cheapest & safest first)

```diagram
Phase 1 — cleanup, no behavior change
  ╭─ config.py + rename contants.py → constants.py   (#2)
  ╰─ runtime.py composition root; shrink main.py      (#1)

Phase 2 — tighten the core
  ╭─ SessionStore class                               (#3)
  ╰─ loop-driven compaction                           (#4)

Phase 3 — the big UX win
  ╰─ ApprovalQueue + /approve /deny commands          (#7, #8)

Phase 4 — reliability
  ╭─ delivery queue (replies + briefings)         (#10, #13)
  ├─ shared SessionLane                               (#12)
  ╰─ retry helper                                     (#11)

Phase 5 — as the bot gets serious
  ╭─ structured tool results + tool families   (#5, #9)
  ├─ step budget                                      (#6)
  ├─ webhook ingress                                  (#14)
  ╰─ background tasks                                 (#15)
```

Phases 1–2 are pure cleanup. Phase 3 is the highest user-facing value. Later
phases are for when Lali is used seriously.

---

## What *not* to copy

- **Turso / libSQL** — overkill for one user; stay on JSONL, move to a single
  SQLite file only when you outgrow it.
- **Streaming preview state machine** — lots of code for marginal benefit until
  turns routinely take >10s.
- **Media-group merge / attachment intake** — build only when the use case needs
  it.
- **Cluster fan-out** — nano-agent-ts removed it itself; not needed here.
