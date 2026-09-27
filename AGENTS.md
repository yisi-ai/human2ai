Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask. 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

5. Git Operation Constraints
   Protect main and keep branch history easy to reason about.

For this repository:

Do not push directly to `main`.
Do not use a plain `git push` when publishing work.
Publish feature branches explicitly with `git push skill-apps HEAD:refs/heads/<branch-name>`.
Create Pull Requests from feature branches into `main`.
Treat `main` as the production deployment branch and inspect the configured GitHub Actions before merging.
Use Chinese commit messages unless the user asks otherwise.
After a Pull Request is merged, prefer deleting the feature branch instead of continuing development on it.
Do not delete remote branches unless the user explicitly confirms which remote branch to delete.
Before branch switching, deleting, rebasing, or merging, check `git status --short --branch`.

6. Product Naming and Localization Gate
   Invoke the semantic naming workflow before changing user-visible language.

When adding, changing, reusing, merging, or removing any user-visible concept, name, label, button, field, status, error, aria-label, prompt copy, enum label, translation key, or locale value, MUST invoke `$i18n-semantic-naming` before editing code or locale files and follow the Skill completely.

This requirement applies even when the task initially mentions only one language. If the Skill is unavailable, or the meaning and reuse decision remain ambiguous after following it, stop and ask the user.

7. Domain Baseline Gate
   Invoke the domain baseline workflow before changing governed business behavior.

When adding, changing, reusing, merging, splitting, or removing a domain operation, application service, business workflow, route-repository pair, stable business schema or error code, or session/capture capability, MUST invoke `$domain-baseline` before editing implementation files and follow the Skill completely.

This requirement also applies when extracting similar implementations or intentionally keeping them separate. It does not apply to UI-only styling, localization-only work, dependency or build configuration, formatting, or tests that do not change business behavior. If the Skill is unavailable, or capability ownership and invariant compatibility remain ambiguous after following it, stop and ask the user.

8. Desktop-only UI Scope
   Use the product's desktop support scope when implementing and reviewing UI.

This product targets desktop computer browsers only. Narrow-screen and mobile layouts are outside the supported scope; do not add them or require their validation unless the user explicitly expands that scope.
Follow `DESIGN.md` for desktop viewport references. Apply generic UI Skill viewport requirements within this product scope.
Continue to handle long content, constrained panels, and internal scrolling within supported desktop layouts.

9. Local Documents and Runtime Data
   Keep internal documents and generated data out of source control and npm packages.

Keep internal documents in ignored `docs/`. Store development databases, service images, exported previews, prompts, and backups under ignored `.human2ai-data/`; use `.human2ai-data/output/` for new CLI `--output` and `--preview` paths. Tests may use temporary directories. The npm-installed service keeps its separate data under `~/.human2ai/`.
Do not force-add ignored documents or generated data. Public builds and governance checks must work without these local files. Runtime source assets, schemas, migrations, public README, Skills, and license notices remain distributable source files.

10. Rendering Scope Gate
    Define and verify the affected scope of interactive updates.

Apply this gate when adding or changing interactive UI state, shared subscriptions, polling, canvas rendering, DOM measurement, or GPU resource updates. Before implementation, state the trigger, state owner, expected update frequency, and components or resources allowed to update. A local edit must not invalidate unrelated expensive subtrees or resources. Distinguish React component execution, DOM mutation/layout/paint, and GPU drawing/resource creation; evidence for one does not prove the others are bounded.

Use these default boundaries:

| Trigger | Allowed work | Work that requires correction or an explicit dependency explanation |
| --- | --- | --- |
| Node note or other nonvisual metadata edit | Input, affected metadata consumers, existing save flow | Unrelated node visuals, sidebar tree, text geometry, or GPU resources |
| Local dialog input | Dialog and its actual dependents | Rebuilding the project/session tree or canvas |
| Poll response with unchanged data | Comparison with current data | Publishing a new state identity or notifying unchanged subscribers |
| Canvas pan/zoom, drag preview, or 3D view gesture | Viewport transforms, affected overlays, necessary scene draws | Page/sidebar updates, unrelated node reconstruction, or geometry recreation |
| One node's visual property or selection changes | That node, previous/new selection, and actual dependents | Recomputing all nodes or rebuilding the whole scene |

Implementation requirements:

- Keep transient input and gesture state with the smallest owner that needs it. Do not lift per-keystroke or per-frame state to a page/shared context solely for convenience. Separate metadata, geometry, selection, and viewing dependencies where they invalidate different work.
- Preserve identities for unchanged data and props across expensive boundaries. Subscribe to the needed slice, skip unchanged poll results, and retain unaffected nodes/resources. When updating a collection immutably, preserve unchanged entries instead of cloning or rebuilding every entry.
- Coalesce pointer/wheel-driven visual updates to at most one scheduled update per animation frame and preserve the final value. Keep existing save, undo, cancellation, and session-switch semantics; performance work must not discard edits or overwrite concurrent changes.
- Cache only with complete dependencies, explicit invalidation, and resource cleanup. Do not hide changing callbacks from memo comparisons or retain stale drafts in cached handlers. Do not add blanket memoization or repeated deep comparisons without showing which work they avoid.
- Separate layout reads from writes. Do not feed unchanged or transform-only measurement results back into document state. Reuse GPU resources when their geometry/material inputs have not changed.
- Debounce, transitions, and deferred rendering change scheduling; they do not establish bounded rendering scope. Measure the eventual work as well as immediate input response.

Verification requirements:

- For a changed high-frequency path or invalidation boundary, exercise it in a browser with a representative desktop fixture. Record fixture size, build mode, interaction, expected scope, and observed scope. When the path scales with node/session count, compare at least two fixture sizes to expose work proportional to unrelated items.
- Assert structural outcomes where practical: unrelated expensive components execute zero times, unchanged polling publishes zero updates, and metadata-only edits allocate/rebuild zero geometry resources. A parent commit or a DOM screenshot alone does not establish which children executed. Use timings and long tasks as supporting evidence, not a universal millisecond threshold.
- Add or extend a focused regression for a corrected performance defect. Exercise the actual UI path when asserting render scope; pure data tests and Storybook builds do not substitute for browser execution. If scope measurement is manual, identify it as manual and retain the evidence under ignored `.human2ai-data/output/`.
- Verify relevant correctness edges: rapid typing/IME composition, the final edit followed immediately by another action, save round trips, gesture completion/cancellation, and switching sessions or stages. Do not claim native IME coverage from synthetic typing alone.
- In the change summary or PR, report `trigger -> allowed scope -> observed scope`, the regression checks, and any remaining broad work. Necessary broad invalidation (for example document replacement, theme changes, or a scene draw after camera movement) must identify its real dependencies and measured cost. It must not be silently treated as a local-update exception.

Type checks, functional unit tests, and successful builds alone do not pass this gate. Do not claim automated rendering-regression protection unless CI actually runs the browser assertions.
