## Conversational style

- keep answers short and concise.
- No emojis in commits, issues, or PRs or code.
- Technical prose only, be direct
- Use concise, clear, simple language. Define unavoidable jargon before using it.
- Explain non-trivial designs and problems as: problem, concrete example or short trace, then solution. State why the solution is necessary and distinguish it from optional complexity.
- Prefer concrete behavior and small illustrations over abstract summaries, dense terminology, or unexplained lists of changes.
- When the user asks a question, answer it first before making edits or running implementation commands.
- When responding to user feedback or an analysis, explicitly say whether you agree or disagree before saying what you changed.

## Code Quality

- No `any` unless absolutely necessary.
- Check node_modules for external API types; don't guess.
- **No inline imports** (`await import()`, `import("pkg").Type`, dynamic type imports). Top-level imports only.
- Never remove or downgrade code to fix type errors from outdated deps; upgrade the dep instead.
- Use only erasable TypeScript syntax (Node strip-only mode) in code checked by the root config (`packages/*/src`, `packages/*/test`, `packages/coding-agent/examples`): no parameter properties, `enum`, `namespace`/`module`, `import =`, `export =`, or other constructs needing JS emit. Use explicit fields with constructor assignments.
- Do not preserve backward compatibility unless the user asks for it.
- **Use modern Node.js built-ins:** Actively look for and utilize the latest features from modern Node.js releases (v22+) rather than relying on outdated patterns or third-party packages.
  - Use `node:sqlite` instead of `better-sqlite3`.
  - Use `process.loadEnvFile()` instead of `dotenv`.
  - Use `node --experimental-strip-types` for running TypeScript natively instead of `tsx`, `ts-node`, or compiling.
  - Use the Node Permission Model (`--permission`) to lock down production services instead of external sandbox tooling.
  - Always prefer Node's standard library over adding new dependencies.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `GajendrasinghDawar/lali`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default canonical triage labels are used: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
