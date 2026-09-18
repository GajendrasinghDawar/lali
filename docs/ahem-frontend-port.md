# Port Ahem's visual system to Lali

Use this instruction when changing Lali's frontend to match the design and interaction patterns in `C:/Users/dawar/projects/ahem`.

## Outcome

Lali should use Ahem's dark Slate/Crimson/Amber/Jade visual system, responsive application shell, sidebar, chat layout, composer, menus, dialogs, and interaction details while retaining Lali's existing architecture and behavior.

This is a visual and component port. Lali remains a React/Vite/TanStack Router client using the Express Gateway, Better Auth, SSE, and its existing APIs.

## Step 1: Establish the boundary

Before editing:

1. Read both repositories' `AGENTS.md` files completely.
2. Run `git status --short` in Lali and preserve existing work.
3. Read Lali's current `src/web/src` tree and `src/web/vite.config.ts`.
4. Read the Ahem source files named in this document completely.
5. Write a short mapping of Ahem components to Lali components and identify required dependencies.

Completion criterion: every Lali feature affected by the port has a named source component, destination component, and preserved behavior.

### Preserve these Lali behaviors

- Better Auth login and logout.
- TanStack Router routes.
- Session creation, selection, archive, restore, reset, and deletion.
- SSE history and streaming.
- Optimistic messages and request state.
- Attachments and upload state.
- Effect approval and rejection.
- Mail and notification routes.
- CSRF handling and existing Gateway paths.

Keep changes under `src/web` except package and frontend build configuration. Treat backend contract changes as a separate task.

## Step 2: Use the same styling layers

Use these layers distinctly:

1. **Radix Colors values** provide the Slate, Crimson, Amber, Jade, and Red scales.
2. **Tailwind CSS 4** generates utilities such as `bg-slate2`, `text-crimson10`, and `border-slate6` from those values.
3. **Radix UI primitives** provide accessible dialogs, dropdown menus, tooltips, scroll areas, sheets, and collapsibles.

Ahem declares its Radix color values manually in `app/theme.css`; it does not need `@radix-ui/colors` at runtime. Copy those values rather than approximating them.

Ahem uses `radix-ui` for Dialog and the other primitives listed above. It uses `@base-ui/react` only for specific radio controls. Preserve the source library used by each component instead of replacing primitives with hand-written behavior.

### Required dependencies

Confirm each import against Ahem and the installed package types before installation. The expected frontend dependencies are:

```text
radix-ui
clsx
tailwind-merge
motion
use-stick-to-bottom
react-use-measure
```

The expected development dependencies are:

```text
tailwindcss
@tailwindcss/vite
```

Add only dependencies used by the port. Do not add Next.js, AI SDK, SWR, shadcn CLI, or Ahem's backend dependencies.

### Vite integration

Add the Tailwind Vite plugin to `src/web/vite.config.ts`. Keep the existing React and TanStack Router plugins and existing development proxies.

The main stylesheet should load:

```css
@import "tailwindcss";
@import "./theme.css";
@import "./typography.css";
```

Use a Vite-compatible Noto Sans setup. `next/font` cannot be ported.

Completion criterion: a production Vite build recognizes Ahem's color utilities and no Next.js module is present in Lali's dependency graph.

## Step 3: Port the design foundation

Copy and adapt:

| Ahem source | Lali destination |
|---|---|
| `app/theme.css` | `src/web/src/styles/theme.css` |
| `app/typography.css` | `src/web/src/styles/typography.css` |
| Relevant base rules from `app/globals.css` | `src/web/src/styles/global.css` |
| `utils/cn.ts` | `src/web/src/lib/cn.ts` |

Preserve exactly:

- Body background `slate2` (`#18191b`).
- Sidebar background `slate1`.
- Crimson primary actions.
- Amber links and focus treatment.
- Jade running and success state.
- Red destructive and failure state.
- Slate text, surface, and border hierarchy.
- Ahem's six-level shadow scale.
- Ahem's prose typography.
- Visible keyboard focus and reduced-motion behavior.

Use Lali branding and English product text. Do not copy the Urmi name, Hindi prompts, or product-specific content.

Completion criterion: Lali renders the same color, typography, border, radius, and shadow system without inline color approximations.

## Step 4: Port accessible UI primitives

Copy and adapt these Ahem components into `src/web/src/components/ui`:

| Ahem source | Lali destination |
|---|---|
| `ui/button.tsx` | `Button.tsx` |
| `ui/dialog.tsx` | `Dialog.tsx` |
| `ui/dropdown_menu.tsx` | `DropdownMenu.tsx` |
| `ui/tooltip.tsx` | `Tooltip.tsx` |
| `ui/scroll_area.tsx` | `ScrollArea.tsx` |
| `ui/input.tsx` | `Input.tsx` |
| `ui/textarea.tsx` | `Textarea.tsx` |
| `ui/avatar.tsx` | `Avatar.tsx` |
| `ui/sidebar/*` | `sidebar/*` |

Adapt aliases, file names, router links, and Vite-compatible imports. Preserve keyboard handling, focus management, portals, mobile sheets, animation behavior, and Tailwind classes.

Follow Lali's TypeScript rules:

- No `any`.
- Top-level imports only.
- Erasable TypeScript syntax.
- Check external package types rather than guessing.

Completion criterion: all menus, dialogs, tooltips, and the mobile drawer are built from accessible primitives and work by keyboard.

## Step 5: Port the application shell

Use these mappings:

| Ahem source | Lali destination |
|---|---|
| `components/new-chat/app_sidebar.tsx` | `features/sessions/SessionSidebar.tsx` |
| `components/new-chat/sidebar_chat_history.tsx` | Session-list components under `features/sessions` |
| `components/new-chat/site_header.tsx` | `features/chat/ChatHeader.tsx` |
| `components/new-chat/nav_user.tsx` | `features/auth/UserMenu.tsx` |

Required behavior:

- Use `100svh` for the application shell.
- Use Ahem's collapsible desktop sidebar and icon-only collapsed state.
- Use the Ahem Sheet pattern for the mobile sidebar.
- Keep sidebar selection derived from TanStack Router.
- Put Mail, Notifications, and Settings in primary navigation.
- Render existing Lali sessions under a Chats group.
- Show a pulsing Jade dot for running sessions when that state is available.
- Use dropdown menus for session actions.
- Use dialogs instead of `prompt()` and `confirm()`.
- Put authenticated-user information and logout in the sidebar footer.
- Keep a compact header with the sidebar trigger and current session context.

Do not port Ahem's vocabulary navigation or model selector.

Completion criterion: desktop expanded, desktop collapsed, and mobile drawer states all navigate correctly without changing Lali's route contracts.

## Step 6: Port the chat presentation

Use these mappings:

| Ahem source | Lali destination |
|---|---|
| `components/new-chat/messages.tsx` | `features/chat/MessageTimeline.tsx` |
| `components/new-chat/message.tsx` | `AssistantMessage.tsx` and `UserMessage.tsx` |
| `components/new-chat/multi_model_input.tsx` | `features/chat/Composer.tsx` |
| `components/new-chat/greeting.tsx` | `features/chat/EmptyChat.tsx` |
| `components/new-chat/thinking_msg.tsx` | `features/chat/ActivityItem.tsx` |
| `components/elements/actions.tsx` | `components/ui/Actions.tsx` |
| `components/playground/ToolCard.tsx` | `features/effects/EffectCard.tsx` |

Retain Lali's hooks, SSE reducer, APIs, Markdown component, attachment handling, and effect mutations. Port presentation, not Ahem's `useChat`, durable transport, SWR state, model selection, voice recording, or voting.

### Transcript

- Center the transcript at Ahem's `max-w-4xl` width.
- Use Ahem's responsive spacing.
- Render user messages as compact right-aligned Slate bubbles.
- Render assistant messages as left-aligned document prose.
- Use the small Jade Sparkles treatment for assistant messages.
- Apply Ahem's `.prose` rules to Markdown.
- Use stable message identifiers rather than array indexes.
- Show quiet copy actions after completed messages.

### Activity

- Render lifecycle state separately from assistant prose.
- Use Ahem's thinking text treatment while active.
- Put details in an accessible collapsible region.
- Respect `prefers-reduced-motion`.

### Composer

Port Ahem's signature-stamp composer appearance:

- Slate 3 surface.
- Slate border and shadow scale.
- Dashed inset border.
- Radial highlight and top highlight line.
- Auto-growing textarea capped at 120px.
- Uppercase compact status indicator.
- Pulsing Jade status dot while active.
- Integrated attachment, send, and stop controls.
- `Enter` sends and `Shift+Enter` inserts a newline.
- Placeholder: `Message Lali...`.

Preserve staged files, upload progress, upload errors, file removal, submission state, and Lali's stop behavior. Exclude voice and model controls.

### Effects

Adapt Ahem's ToolCard visual treatment:

- Amber: pending approval.
- Jade: approved, executing, or executed.
- Red: failed.
- Slate: rejected, expired, interrupted, or unknown.
- Collapsed details for payload and digest.
- Shared Button components for Approve and Reject.

Completion criterion: empty, streaming, completed, failed, attachment, and effect-approval turns retain their behavior and match Ahem's visual hierarchy.

## Step 7: Restyle secondary routes

Apply the same components and tokens to:

- `/login`
- `/mail`
- `/notifications`
- `/settings`

Use structured lists, shared buttons, accessible loading/error states, and Ahem's compact section treatment. Keep each route's current API calls unchanged.

Completion criterion: every route uses the shared visual system and contains no inline style objects.

## Step 8: Verify

Add or retain scripts for backend type checking, frontend type checking, tests, and the frontend production build.

At minimum run:

```bash
npm run typecheck
npm test
npx vite build src/web --config src/web/vite.config.ts
```

Verify manually at 1440x900 and 390x844:

- Login.
- Empty chat.
- User and assistant messages.
- Streaming activity.
- Attachments.
- Effect approval.
- Expanded and collapsed desktop sidebar.
- Mobile sidebar.
- Mail, notifications, and settings.
- Keyboard navigation and focus restoration.

When Ahem can run locally, capture equivalent reference screenshots before implementation and compare dimensions, colors, typography, borders, shadows, and spacing.

Completion criterion: checks pass, existing Lali behavior remains functional, and every visual difference from Ahem is documented with a concrete compatibility reason.

## Final report

Report:

1. Dependencies added.
2. Files created and modified.
3. Preserved Lali behaviors.
4. Commands and tests run.
5. Visual verification performed.
6. Remaining differences from Ahem and why they are necessary.
