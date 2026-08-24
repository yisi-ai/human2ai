---
name: human2ai-composition
description: Use the installed Human2AI Web and CLI to open an interactive image-composition session, read a user-saved draft revision, choose an aesthetic treatment as the Agent, and submit a protected refinement. Use when a local project asks to create, manage, or refine Human2AI composition sessions. Do not use this skill to choose aesthetics algorithmically, access SQLite directly, or process ui-layout sessions.
---

# Human2AI Composition

Treat the Agent as the aesthetic decision-maker. Treat Human2AI as the executor and geometric guardrail: it exposes neutral measurements and named operations, but it must not recommend a style or choose an operation.

## Preconditions

Use the installed `human2ai` executable. Commands emit JSON on standard output and structured errors on standard error.

Before using a composition session, check the shared Human2AI service:

```bash
human2ai project list
```

If it succeeds, reuse that service; do not start another. If it returns `SERVICE_UNAVAILABLE`, start `human2ai web` in a persistent terminal, wait for its `listening` or `already-running` result, and retry `human2ai project list`. The command starts both the browser UI and API. Do not read or modify `~/.human2ai/human2ai.sqlite` directly.

## Work with projects and sessions

A project may contain multiple typed sessions. A session may also remain unassigned.

```bash
human2ai project create --name "<project name>" --description "<purpose>"
human2ai session create --type image-composition --title "<title>" --project <project-id>
human2ai session create --type image-composition --title "<title>"
human2ai session list --project <project-id>
human2ai session list --unassigned
```

Use the returned `id` and `revision` values. When moving a session, pass its current revision:

```bash
human2ai session move --session <session-id> --project <project-id> --expected-revision <n>
human2ai session move --session <session-id> --unassigned --expected-revision <n>
```

Give the user the composition page for the selected session:

```text
http://127.0.0.1:4179/composition/?session=<session-id>
```

Respect `HUMAN2AI_SERVER_URL` when the service uses a non-default origin. If the session has no draft revision, stop refinement work until the user draws in the page and clicks **Save for AI**. Never infer an unsaved browser state from the database or local files.

## Refine a composition

1. List the current methods and their plan schema. Never invent an operation that is absent from this response.

   ```bash
   human2ai composition methods
   ```

2. List draft revisions, then inspect the exact revision being considered. Generate a preview when visual inspection is useful.

   ```bash
   human2ai composition drafts --session <session-id>
   human2ai composition inspect --session <session-id> --revision <n> --preview <preview.svg>
   ```

3. Look at the draft or preview and consider the user's goal. Choose the aesthetic direction yourself. Use the inspection only as geometric evidence; it is not a recommendation.

4. Write a versioned `composition-refinement-plan` JSON file that conforms to the returned schema. Copy the inspection's exact `sourceFingerprint`, explain the visual reasoning in `rationale`, and use only named semantic operations. Do not calculate or submit unrestricted final coordinates.

5. Apply the plan to the same session revision.

   ```bash
   human2ai composition apply --session <session-id> --revision <n> --plan <plan.json> --output <run.json> --preview <refined.svg>
   ```

6. Check that `result.audit.passed` is true before presenting the result. Preserve the original draft revision; a refinement run is an audited derivative, not an overwrite.

If the service reports `REFINEMENT_PLAN_STALE`, inspect the current revision again and make a new plan from the new fingerprint. If it reports `REFINEMENT_CONSTRAINT`, explain which guardrail rejected the transformation and revise the aesthetic plan rather than bypassing the constraint.

To import a draft into a new or existing session, use the latest known revision for optimistic concurrency; use `0` only when the session has no drafts:

```bash
human2ai composition save --session <session-id> --draft <draft.json> --expected-revision <n>
```
