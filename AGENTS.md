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
