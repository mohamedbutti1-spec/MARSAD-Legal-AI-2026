# Codex Cloud Working Rules

## Scope
This branch is the dedicated cloud workspace for Codex-assisted development of MARSAD.

## Safety rules
- Work only on this branch unless explicitly instructed otherwise.
- Do not deploy or publish.
- Do not modify production server configuration.
- Do not modify database credentials, connection strings, API keys, secrets, or environment values.
- Do not delete production data or migrations.
- Do not merge into release/v1.0 automatically.

## Development workflow
1. Inspect the relevant files before editing.
2. Explain the planned change briefly.
3. Make the smallest change needed.
4. Run available tests, lint, type-check, and build checks when possible.
5. Report changed files and any remaining risks.
6. Prepare changes for review; human approval is required before merge or deployment.

## Priority
Preserve the current approved full MARSAD interface and existing authentication/backend behavior unless a task explicitly requests a change.
