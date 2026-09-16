# Lali Web UI Implementation

## Status

This document defines how to replace `src/web/index.html` with a production-oriented chat interface built with React, Vite, and TanStack Router while retaining Express as Lali's trusted Gateway.

The target is a focused, ChatGPT-like interface for one owner. It is not a copy of ChatGPT, NanoBot, or OpenClaw. It adopts their useful interaction and state-management patterns while avoiding their multi-agent and platform complexity.

## Decision

Use:

- React and TypeScript for the UI.
- Vite with `src/web` as its root.
- TanStack Router with file-based routes.
- Express as the only HTTP, authentication, SSE, integration, and background-work owner.
- Native CSS or CSS Modules with shared design tokens.
- Accessible headless primitives only where browser primitives are insufficient, such as dialogs and menus.
- A streaming-safe Markdown renderer with raw HTML disabled.

Do not move Telegram polling, scheduled jobs, queue processing, effect execution, or Agent communication into the frontend toolchain.

```text
Browser
  -> Vite static application
  -> Express Gateway over same-origin HTTP and SSE
  -> Agent over the existing Unix socket protocol
```

In development, Vite proxies Gateway paths to `http://127.0.0.1:3000`. In production, Nginx serves the Vite build and proxies Gateway paths to Express.

## Research summary

### NanoClaw

NanoClaw v2 does not contain a core browser chat interface. Its useful pattern for Lali is architectural: the trusted host owns routing, durable state, permissions, privileged actions, and delivery. The untrusted agent produces structured messages but does not own external delivery. [NC1][NC2][NC3]

Adopt:

- The Gateway remains authoritative.
- UI state is a projection of durable Gateway state.
- Privileged operations remain structured and explicit.
- Delivery and approval status must be visible rather than inferred from generated text.

Do not copy:

- Per-session container or two-database mechanics into the browser.
- NanoClaw's entity model; Lali is currently a single-owner product.

### nanobot

nanobot provides the closest visual and component model for Lali. Its WebUI uses React, TypeScript, Vite, Tailwind, and a gateway transport. It separates the thread shell, viewport, timeline, message rendering, composer, sessions, and stream reducer. [NB1][NB2][NB3]

Useful patterns include:

- A compact session sidebar and a centered conversation column.
- Right-aligned user bubbles and document-like assistant responses.
- A sticky composer with attachment, model, voice, and workspace controls.
- Optimistic user messages followed by canonical reconciliation.
- Collapsible agent activity instead of rendering tool output as ordinary chat.
- A scroll-to-bottom control that appears only after the user leaves the live edge.
- History windows and prepend anchoring for long conversations.
- Streaming updates batched through `requestAnimationFrame` while the page is visible.
- Lazy loading the heavy Markdown renderer and syntax highlighting only after streaming completes.
- Tests around session switching, streaming, scroll behavior, message rendering, and the composer.

Do not copy directly:

- `App.tsx`, `ThreadComposer.tsx`, and `useNanobotStream.ts` are already very large. Lali should split transport, state reduction, and presentation before they reach that scale.
- Lali does not yet need voice, model selection, MCP mentions, skills catalogs, forks, or file previews.

### OpenClaw

OpenClaw's Control UI is much larger than Lali and is implemented with Lit rather than React. Its value is in production interaction rules, not component code. Its UI guide explicitly treats Gateway state as authoritative, scopes asynchronous work to the active connection/session, and prevents stale responses from replacing a newer selection. Its chat documentation and implementation separately model session navigation, composer state, transcript scrolling, optimistic delivery, reconnect recovery, and live-to-canonical reconciliation. [OC1][OC2][OC3][OC4][OC5][OC6]

Useful patterns include:

- A dropped connection does not clear the visible conversation or draft.
- Pending sends have explicit delivery states.
- Idempotency keys reconcile optimistic messages with durable messages.
- Live stream fragments are temporary; canonical history replaces them without duplication.
- Session switches preserve each session's draft and scroll position.
- History refreshes cannot remove a newer optimistic message.
- Composer input remains available while history loads.
- Agent activity, errors, approvals, attachments, and normal prose are distinct timeline item types.
- Scroll ownership is explicit: automatic following stops as soon as the user browses history.
- The Gateway owns shared state; browser caches are scoped projections.

Do not copy:

- Offline attachment storage, split panes, side chat, multi-user presence, team mode, session trees, voice/video, browser panels, worktrees, or thousands of specialized components.
- Full transcript virtualization in the first release. Add it only after measured transcript size requires it.

## Current Lali constraints

The current frontend is one 373-line HTML document containing markup, styles, API calls, mutable state, SSE handling, uploads, effects, and authentication. [L1]

It has several constraints that the new UI must address:

1. `innerHTML` renders message text and effect data. Model and integration content is untrusted and must not enter HTML directly.
2. User messages are stored in `requests`, while agent events are stored in `events`. Reloading SSE history cannot reconstruct the complete conversation.
3. `sseEmitters` stores one callback per session. A second tab replaces the first subscriber.
4. SSE messages do not set an `id:` field or consume `Last-Event-ID`, so automatic reconnect can replay duplicates.
5. Session events are low-level transport events based on the Gateway-Agent protocol rather than a documented browser timeline contract. [L4]
6. Effect approval state is not represented as a durable timeline transition.
7. Interrupting changes Gateway state but does not currently cancel Agent/model execution.

The React migration must not hide these backend problems with browser-local assumptions.

## Product experience

### Desktop layout

```text
+----------------------+---------------------------------------------+
| Lali                 | Conversation title                 actions  |
| New chat             +---------------------------------------------+
| Search               |                                             |
|                      | centered transcript                         |
| Main Session         | user bubble                                 |
| Project A            | assistant prose                             |
| Email Thread         | activity / approval cards                   |
|                      |                                             |
|                      +---------------------------------------------+
| Notifications        | sticky composer                             |
| Mail          User   | attach   message...              send/stop  |
+----------------------+---------------------------------------------+
```

- Sidebar width: approximately 272-288 px.
- Transcript text column: approximately 760-800 px.
- Composer maximum width: approximately 880-920 px.
- Header remains compact and does not compete with the conversation.
- Assistant responses render as readable prose without a large colored bubble.
- User messages render as compact, right-aligned muted bubbles.
- The composer remains visible at the bottom.

### Mobile layout

- The sidebar becomes a modal drawer.
- The transcript and composer use the full viewport width.
- Controls have at least a 44 px touch target.
- The composer accounts for `env(safe-area-inset-bottom)`.
- The layout responds to `window.visualViewport` so the software keyboard does not cover the composer.
- Secondary actions move into menus instead of wrapping into several toolbar rows.

### Empty state

Show:

- A short greeting.
- The main composer.
- Optional starter prompts only when they represent real Lali capabilities.

Do not show fake actions or capabilities that the Agent does not have.

### Timeline presentation

The visible timeline has five item types:

1. **User message** — text, attachments, timestamp, and delivery status.
2. **Assistant message** — streaming or complete Markdown, copy action, and error state.
3. **Activity** — compact lifecycle/tool/status row; collapsible when details exist.
4. **Effect approval** — summary, safe structured details, expiry, digest summary, and approve/reject controls.
5. **System notice** — interruption, reconnect, queue pause, or durable failure.

Do not render lifecycle messages as normal assistant replies.

### Composer behavior

Required for the first release:

- Multiline textarea.
- Enter sends; Shift+Enter inserts a newline.
- Attachment selection with removable previews.
- Send button while idle.
- Stop button while the current request is running.
- Disabled state with a concrete reason.
- Draft preserved per session in browser storage.
- File-size and type errors shown before upload.

Later additions may include slash commands, voice, workspace selection, and model selection. They must not be included until the corresponding backend capability exists.

## Routes

Use TanStack Router file-based routes:

```text
src/web/src/routes/
  __root.tsx
  login.tsx
  index.tsx
  chat.$sessionId.tsx
  mail.tsx
  notifications.tsx
  settings.tsx
```

Behavior:

- `/` redirects to `/chat/main` for the existing owner assistant.
- `/chat/$sessionId` owns one conversation.
- `/mail` displays inbound email threads.
- `/notifications` displays the durable notification history.
- `/settings` initially contains appearance and account/session actions only.
- Authentication failure redirects to `/login` while preserving the intended destination.

The route parameter is the selected session owner. Do not maintain an unrelated global `activeSessionId` that can disagree with the URL.

## Source structure

Use feature ownership rather than one large application component:

```text
src/web/
  index.html
  src/
    main.tsx
    routeTree.gen.ts
    routes/
      __root.tsx
      index.tsx
      login.tsx
      chat.$sessionId.tsx
      mail.tsx
      notifications.tsx
      settings.tsx
    app/
      router.tsx
      AppShell.tsx
    components/
      ui/
        Button.tsx
        Dialog.tsx
        Menu.tsx
        Spinner.tsx
    features/
      auth/
        auth-api.ts
        AuthGate.tsx
      sessions/
        session-api.ts
        SessionSidebar.tsx
        session-types.ts
      chat/
        chat-api.ts
        chat-events.ts
        chat-reducer.ts
        chat-types.ts
        use-chat-session.ts
        ChatPage.tsx
        ChatHeader.tsx
        MessageTimeline.tsx
        MessageItem.tsx
        AssistantMessage.tsx
        UserMessage.tsx
        ActivityItem.tsx
        Composer.tsx
        AttachmentPreview.tsx
        ScrollController.ts
      effects/
        effect-api.ts
        EffectCard.tsx
        effect-types.ts
      mail/
      notifications/
    lib/
      csrf.ts
      http.ts
      storage.ts
    styles/
      tokens.css
      global.css
      shell.css
```

Rules:

- Route components select identifiers and compose features.
- API modules translate HTTP payloads into validated frontend types.
- `chat-reducer.ts` is the only owner of timeline transitions.
- Components receive display-ready state and emit user intent.
- Components do not call `fetch` directly.
- Browser storage stores presentation state and unsent drafts, not authoritative message history.

## State ownership

| State | Owner | Browser behavior |
|---|---|---|
| Authentication | Gateway/Better Auth | Read session; never copy credentials into local storage |
| Session list and metadata | Gateway | Cache per authenticated owner; reconcile on refresh |
| Messages and request status | Gateway | Project timeline; optimistic entries are temporary |
| Effect status | Gateway | Render and mutate through effect API |
| Notifications and email | Gateway | Fetch and invalidate after mutations |
| Active session | URL | TanStack Router route parameter |
| Draft text and staged local files | Browser/session route | Preserve per session |
| Sidebar open state and theme | Browser | Local preference |
| Scroll position | Browser/session route | Restore only for the matching session |

Every asynchronous result must carry or close over the session ID and a request generation. Before applying it, verify that it still belongs to the current session. This prevents a slow response from session A appearing after the user switches to session B. This is a central OpenClaw UI rule. [OC1]

## Canonical timeline contract

### Problem

A proper chat cannot be reconstructed from Lali's current SSE stream. `requests` contains the user message, while `events` contains text, lifecycle, completion, error, and effect events. [L2][L3]

Example:

```text
requests: "Review this file"
events:   lifecycle -> text -> text -> done
```

After a reload, the browser can replay the assistant events but cannot place the corresponding user message into a canonical timeline.

### Required solution

The Gateway must expose a durable, ordered timeline containing both sides of the conversation. The smallest change is to append a `user_message` event transactionally when a request is accepted. The event uses the request ID and the next session sequence.

Required durable event shapes:

```ts
type TimelineEvent =
  | { sequence: number; type: "user_message"; requestId: string; data: UserMessageData }
  | { sequence: number; type: "lifecycle"; requestId: string; data: LifecycleData }
  | { sequence: number; type: "text"; requestId: string; data: TextDeltaData }
  | { sequence: number; type: "done"; requestId: string; data: DoneData }
  | { sequence: number; type: "error"; requestId: string; data: ErrorData }
  | { sequence: number; type: "propose_effect"; requestId: string; data: EffectData }
  | { sequence: number; type: "effect_status"; requestId: string; data: EffectStatusData }
  | { sequence: number; type: "interrupted"; requestId: string; data: InterruptedData };
```

Validate this union at the browser boundary. Unknown event types should be logged and ignored without breaking the stream.

### SSE contract

The existing `/chat/events` endpoint can remain initially, but it must:

1. Accept `sessionId` and `after`.
2. Replay durable events with `sequence > after`.
3. Emit `id: <sequence>` for every event.
4. Respect `Last-Event-ID` on reconnect.
5. Support multiple subscribers per session with a `Set`, not one callback.
6. Remove only the closing response's subscriber.
7. Send periodic comment heartbeats so Nginx and other proxies do not silently close idle streams.
8. Disable proxy buffering for the SSE location.

The client must still deduplicate by sequence because networks can replay data.

### Browser reducer

Use one pure reducer per active session:

```ts
type ChatAction =
  | { type: "snapshotLoaded"; events: TimelineEvent[] }
  | { type: "eventReceived"; event: TimelineEvent }
  | { type: "submissionStarted"; idempotencyKey: string; draft: DraftMessage }
  | { type: "submissionAccepted"; idempotencyKey: string; requestId: string }
  | { type: "submissionRejected"; idempotencyKey: string; error: string }
  | { type: "connectionChanged"; status: ConnectionStatus };
```

Reducer invariants:

- `sequence` is applied at most once.
- `requestId` identifies one user turn and its assistant output.
- An optimistic user entry is replaced or bound when `POST /chat` returns its request ID.
- Text deltas append only to that request's active assistant entry.
- `done`, `error`, and `interrupted` close the request.
- Canonical history never removes a newer optimistic entry unless it contains a matching durable user event or an explicit rejection.
- An effect card is unique by effect ID and updates in place.
- Switching sessions creates or restores a separately scoped reducer; events from the old EventSource are ignored.

### Streaming performance

Do not render once per token. Collect text events and flush them at most once per animation frame while the page is visible. Flush immediately on `done`, `error`, session switch, or page hide. nanobot uses this pattern to avoid excessive React updates. [NB4]

## Component behavior

### Application shell

`AppShell` owns only:

- Desktop sidebar versus mobile drawer.
- Global navigation.
- Authenticated user menu.
- Theme.
- Route outlet.

It does not own chat messages.

### Session sidebar

The first release supports:

- New chat.
- Active and archived sessions.
- Selected state derived from the URL.
- Rename, archive/restore, and delete actions.
- Running, unread, or failed status indicators when the Gateway can provide them.
- A search dialog after the basic list is stable.

Keep rows compact. Do not reproduce OpenClaw's nested agent/session trees.

### Message timeline

- Use semantic list/article elements.
- Maintain stable keys from request ID, event sequence, or effect ID; never use an array index for durable items.
- Render at the bottom on first load.
- Follow streaming output only while the user remains near the bottom.
- User wheel, touch, keyboard, or scrollbar movement transfers scroll ownership to the user.
- Show a floating “scroll to latest” button while detached from the bottom.
- When older messages are prepended, preserve the visible anchor by adding the change in scroll height to the previous scroll position.
- Start with paginated windows rather than full virtualization. Introduce virtualization only after measurement shows a real need.

### Messages

User message:

- Compact right-aligned bubble.
- Plain escaped text with preserved whitespace.
- Attachment tiles.
- Queued, sending, delivered, failed, or interrupted state.
- Retry only when the Gateway can safely use the same idempotency key.

Assistant message:

- Full-width prose inside the centered text column.
- Streaming-safe Markdown.
- Code blocks with copy controls.
- External links open with `noopener noreferrer`.
- Copy response action after completion.
- Stable reserved footer space to avoid layout jumps when actions appear.

Activity:

- Quiet “Thinking”, “Streaming”, or lifecycle label.
- Details collapsed by default.
- Never display raw secrets, internal prompts, or arbitrary debug payloads.

### Effect approval card

The card must show:

- Clear action name and human-readable summary.
- Known fields rendered by effect type, such as email recipient, subject, and body.
- A fallback JSON viewer that renders text, not HTML.
- Expiration state.
- A short digest for confirmation.
- Approve and Reject as distinct actions.
- Pending, executing, executed, rejected, expired, failed, and unknown states.
- Controls disabled after the first mutation begins.

The card must update from the authoritative mutation response and later `effect_status` events. Approval is not complete merely because the browser received HTTP 200; execution has its own outcome.

### Markdown

Follow nanobot's useful split: show a plain-text fallback while the heavy renderer loads, parse incomplete Markdown during streaming, and enable expensive syntax highlighting after completion. [NB5][NB6]

Security requirements:

- Raw HTML disabled by default.
- Explicit URL protocol allowlist.
- No `javascript:`, unsafe data URLs, or automatic arbitrary embeds.
- React text rendering instead of `dangerouslySetInnerHTML`.
- Code and JSON rendered as text.
- Remote images disabled until Lali defines an authenticated media policy.

## Styling system

Use a small token layer rather than copying another product's palette:

```css
:root {
  --color-bg: ...;
  --color-surface: ...;
  --color-surface-muted: ...;
  --color-text: ...;
  --color-text-muted: ...;
  --color-border: ...;
  --color-accent: ...;
  --color-danger: ...;
  --color-warning: ...;
  --sidebar-width: 17.5rem;
  --content-width: 49rem;
  --composer-width: 57rem;
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
}
```

Requirements:

- Light and dark themes.
- System theme as the default.
- One spacing scale.
- Visible focus indicators.
- Reduced-motion support.
- Color never acts as the only status indicator.
- Avoid excessive gradients, glass effects, and animation. The conversation is the primary surface.

## Security requirements

The migration must improve security, not only appearance:

1. Remove all message and effect `innerHTML` rendering.
2. Remove inline scripts so Helmet can drop `'unsafe-inline'` from `script-src`.
3. Keep Better Auth cookies HTTP-only, secure in production, and same-site.
4. Keep CSRF protection on every state-changing request.
5. Do not store auth tokens or integration secrets in browser storage.
6. Validate API and event payloads at the browser boundary.
7. Render approval payloads through typed views.
8. Treat filenames, Markdown, links, model output, email, and notification text as untrusted.
9. Use same-origin requests in production.
10. Never expose Gateway integration credentials to Vite environment variables; `VITE_*` values are public.

## Accessibility requirements

- One visible page heading.
- Semantic landmarks for navigation, main content, and complementary panels.
- Composer has a persistent accessible label.
- Streaming status uses a restrained `aria-live="polite"` region; do not announce every token.
- Errors and approval results are announced once.
- All menus and dialogs restore focus to their trigger.
- Escape closes transient surfaces.
- Message actions are keyboard reachable and not hover-only.
- Send/stop state has text labels for assistive technology.
- Test keyboard-only use and 200% zoom.

## Backend work required before feature parity

1. Add durable `user_message` events transactionally with request creation.
2. Add durable effect status transitions.
3. Support multiple SSE subscribers per session.
4. Add SSE IDs, `Last-Event-ID`, heartbeat comments, and sequence deduplication.
5. Expose session metadata needed by the sidebar without direct database assumptions in the UI.
6. Return structured validation errors from uploads and mutations.
7. Make request interruption semantics explicit: requested, acknowledged, or unable to cancel.
8. Add pagination before conversations become unbounded.

These changes should be implemented and tested at the Gateway contract before the UI depends on them.

## Implementation phases

### Phase 0: Contract and safety

- Define shared browser-facing schemas.
- Add canonical user-message and effect-status events.
- Correct SSE reconnect and multi-subscriber behavior.
- Add Gateway contract tests.

Exit condition: a fresh browser can reconstruct the same timeline after reload without browser-only message history.

### Phase 1: Application shell and basic chat

- Add Vite, React, and TanStack Router.
- Add auth gate and login route.
- Add responsive shell and session sidebar.
- Add `/chat/$sessionId`.
- Render user and assistant text.
- Add multiline composer and optimistic submission.
- Add SSE reducer and send/stop state.

Exit condition: login, send, streaming response, reload, reconnect, and session switching work without duplicate or misplaced messages.

### Phase 2: Rich messages

- Add safe streaming Markdown.
- Add code blocks and copy actions.
- Add attachment staging, upload progress, previews, and failures.
- Add activity rows and scroll-to-latest behavior.

Exit condition: long responses, code, files, mobile keyboard, and user-controlled scrolling behave correctly.

### Phase 3: Effects and operational surfaces

- Add effect approval cards.
- Add notifications route and indicator.
- Add mail route and email-thread navigation.
- Add session rename, archive, restore, reset, and delete.

Exit condition: every existing feature in `src/web/index.html` has an equivalent typed UI flow.

### Phase 4: Production polish

- Remove the legacy inline client.
- Remove unsafe inline CSP allowances.
- Add Nginx static and SSE configuration.
- Add lazy chunks for Markdown and secondary routes.
- Run accessibility, responsive, and browser checks.
- Add production logging for frontend contract failures without logging private content.

Exit condition: the old HTML has no remaining runtime path and the release checklist covers the new UI.

## Testing strategy

### Unit tests

Prioritize pure state behavior:

- Timeline event reduction and sequence deduplication.
- Optimistic-to-canonical reconciliation.
- Session-scoped stale result rejection.
- Stream completion, interruption, failure, and effect updates.
- Draft storage keys and migrations.
- Safe link and Markdown policies.

### Component tests

Use Vitest and Testing Library for:

- Composer keyboard behavior.
- Attachment removal and validation.
- Assistant/user/activity/effect rendering.
- Disabled and loading states.
- Sidebar route selection.
- Focus restoration for dialogs and menus.

### Browser tests

Use Playwright for the small set of critical flows:

1. Login redirect and return.
2. Send a message and receive streamed chunks.
3. Reload and reconstruct the complete conversation.
4. Disconnect, reconnect, and avoid duplicates.
5. Switch sessions while a previous request resolves.
6. Approve and reject an effect.
7. Upload and remove an attachment.
8. Use the interface at phone width with the software-keyboard layout simulated.
9. Navigate the primary flow with a keyboard.

Use a deterministic fake Gateway or fake Agent for UI tests. Do not require paid model calls.

## First-release acceptance criteria

- The UI works at 360 px width and ordinary desktop widths.
- A reload preserves the complete canonical conversation.
- Opening two tabs does not disconnect either SSE subscriber.
- Reconnect does not duplicate messages.
- Switching sessions cannot leak messages, drafts, or late fetch results across sessions.
- The user can interrupt, resume, clear, and observe the resulting state.
- Effects are clearly separate from assistant prose and cannot execute twice from repeated clicks.
- Message, email, notification, filename, and effect content cannot inject HTML.
- The composer remains usable while history loads.
- Streaming does not force the viewport to the bottom after the user scrolls upward.
- The old UI's login, chat, attachments, effects, notifications, and email access have replacement flows before it is removed.

## Explicit non-goals for the first release

- Multi-agent team mode.
- Split chat panes.
- Side chat.
- Voice or realtime video.
- Browser terminal or desktop control.
- Session forks and branches.
- Full offline attachment queues.
- Tool graphs and nested subagent timelines.
- Plugin-provided UI.
- Internationalization beyond keeping text centralized and layouts adaptable.
- Transcript virtualization without measured need.

## Source references

The NanoClaw and nanobot directories are local source snapshots without Git metadata. The OpenClaw observations refer to local commit `8432c139340a7a665288a291d94d6a7cbe5079c6`.

### NanoClaw

- [NC1] `C:/Users/dawar/projects/repos/nanoclaw-main/README.md` — host, session, and container message flow.
- [NC2] `C:/Users/dawar/projects/repos/nanoclaw-main/CLAUDE.md` — entity model, two-database split, trusted host responsibilities, and key files.
- [NC3] `C:/Users/dawar/projects/repos/nanoclaw-main/src/router.ts` and `src/delivery.ts` — inbound routing, access checks, durable message writing, guarded outbound delivery, and duplicate-delivery protection.

### nanobot

- [NB1] `C:/Users/dawar/projects/repos/nanobot-main/webui/package.json` and `webui/vite.config.ts` — React/Vite frontend, UI dependencies, build output, development proxy, and test environment.
- [NB2] `C:/Users/dawar/projects/repos/nanobot-main/docs/webui.md` — WebUI product behavior, topics, activity, composer, workspaces, and settings.
- [NB3] `C:/Users/dawar/projects/repos/nanobot-main/webui/src/components/thread/ThreadShell.tsx`, `ThreadMessages.tsx`, `ThreadViewport.tsx`, and `ThreadComposer.tsx` — thread composition, session-scoped state, timeline units, scrolling, and composer behavior.
- [NB4] `C:/Users/dawar/projects/repos/nanobot-main/webui/src/hooks/useNanobotStream.ts` — optimistic messages, stream batching, turn identity, activity segments, and session reset behavior.
- [NB5] `C:/Users/dawar/projects/repos/nanobot-main/webui/src/components/MessageBubble.tsx` — user bubbles, assistant prose, copy actions, activity groups, attachments, and thinking state.
- [NB6] `C:/Users/dawar/projects/repos/nanobot-main/webui/src/components/MarkdownText.tsx` and `MarkdownTextRenderer.tsx` — lazy renderer, streaming fallback, incomplete Markdown, safe URL policy, and code rendering.

### OpenClaw

- [OC1] `C:/Users/dawar/projects/repos/openclaw/ui/AGENTS.md` — Gateway state ownership, scoped async results, optimistic recovery, and stale-result rules.
- [OC2] `C:/Users/dawar/projects/repos/openclaw/docs/web/control-ui/chat.md` — composer, transcript, history, idempotency, stream/history reconciliation, message actions, and responsive interaction semantics.
- [OC3] `C:/Users/dawar/projects/repos/openclaw/docs/web/control-ui/offline-and-reconnect.md` — reconnect, drafts, delivery uncertainty, and outbox ownership.
- [OC4] `C:/Users/dawar/projects/repos/openclaw/docs/web/control-ui/sessions-and-sidebar.md` — session navigation, pending input custody, sidebar status, and session actions.
- [OC5] `C:/Users/dawar/projects/repos/openclaw/ui/src/pages/chat/chat-state-contract.ts`, `history-merge.ts`, and `stream-reconciliation.ts` — scoped chat state and canonical/live reconciliation.
- [OC6] `C:/Users/dawar/projects/repos/openclaw/ui/src/pages/chat/components/chat-transcript-controller.ts` and `chat-composer.ts` — session-owned scrolling and composer orchestration.

### Lali

- [L1] `src/web/index.html` — current UI and API behavior.
- [L2] `src/gateway/queue.ts` — requests, events, sequence assignment, SSE publication, and Agent event handling.
- [L3] `src/gateway/server.ts` — authentication, sessions, chat, effects, SSE, email, notifications, and artifact endpoints.
- [L4] `src/shared/protocol.ts` — current Gateway-Agent request and event protocol.
