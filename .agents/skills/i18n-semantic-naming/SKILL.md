---
name: i18n-semantic-naming
description: Govern user-visible product naming and localization by recording meaning before choosing translation keys or copy. Use whenever work adds, changes, reuses, merges, or removes a UI label, button, field, status, error, aria-label, prompt copy, enum label, translation key, or locale value, even if only one language is mentioned.
---

# I18n Semantic Naming

Use meaning as the source of truth. A source-language phrase is evidence, not a translation specification.

## Required workflow

1. Inspect the actual UI, caller, control role, nearby copy, produced output, and every supported locale before editing copy or keys.
2. Describe the concept before naming it:
   - what it means and refers to;
   - where its meaning applies;
   - whether it has precedence over, contains, or differs from nearby concepts;
   - the UI role, grammar, and tone of this occurrence;
   - examples and non-examples that expose the boundary.
3. Search `locales/_meta/semantics/` and locale resources by meaning, `searchTerms`, key, and rendered text. Use targeted `rg` searches; do not load every shard when one domain is sufficient.
4. Classify the occurrence:
   - reuse a canonical key only when meaning, scope, role, grammar, and tone are compatible;
   - create a contextual variant when the concept is shared but its UI use requires different copy;
   - keep separate concepts when equal rendered text is coincidental.
5. Stop and ask the user when meaning, scope, precedence, or reuse remains ambiguous after inspecting the product context. Do not infer meaning from the Chinese wording alone.
6. Add or update the concept and all of its key records in one semantic shard before editing locale values. Use `shared.json` for concepts intentionally reused across product areas and the owning domain shard otherwise. When adding a shard, register it in sorted order in `locales/_meta/semantic-catalog.json`. A semantic record supersedes a matching legacy key; never edit the frozen legacy key inventory. Update only its hash to the value printed by the checker after migration.
7. Write each locale independently as natural product copy. Keep placeholders equivalent across locales and review all supported locales together.
8. Update callers, accessibility copy, generated prompts, fixtures, stories, and tests only where the semantic change requires it.
9. Run `npm run i18n:check`. Fix every failure; do not put new or changed keys into the legacy baseline to bypass the gate.
10. Report the recorded meaning, reuse decision, affected locales, and verification result.

## Catalog contract

`locales/_meta/semantic-catalog.json` is the language-independent manifest for files under `locales/_meta/semantics/`. Keep each concept and all of its canonical and contextual keys together in one shard so its reuse boundary can be reviewed without cross-file reconstruction.

Each concept records `meaning`, `scope`, `referent`, `precedence`, `canonicalKey`, multilingual `searchTerms`, `examples`, and `nonExamples`. Each translation key records its `conceptId`, contextual `variant`, UI `role`, `grammar`, `tone`, and `reusePolicy`.

Use `reusePolicy: "canonical"` when the key is the default reusable expression of that concept. Use `reusePolicy: "contextual"` when its role or context intentionally requires a distinct expression.

Every concept has exactly one `canonicalKey`. Promote a suitable legacy key when it is already neutral and reusable; otherwise create a stable shared key and move callers to it. Do not keep runtime aliases after callers have migrated.

When any locale renders a semantic key exactly like another key, add `duplicateReason` explaining why reuse is incorrect or why the existing legacy key cannot yet be reused. Equal spelling does not prove equal meaning; different spelling does not prove different meaning.

`locales/_meta/legacy-baseline.json` is a frozen inventory of transitional debt, not a naming source. Never add, remove, or rename its keys. Migrate legacy keys by adding semantic records that supersede them, and audit the rest in bounded feature-area batches rather than retranslating them without UI context.

## Naming rules

- Prefer stable concept names over page layout or source-language wording in key paths.
- Do not create both a generic key and a component-local key for the same compatible use merely for convenience.
- Do not force confirmation titles, action buttons, field labels, and sentences to share one key when their grammar or interaction role differs.
- Preserve implementation terms such as `Agent` only when users need them to understand the product.
- Keep English controls concise when a familiar single word remains unambiguous.

Example: if `总备注` means the highest-level note governing all subordinate notes, record that precedence explicitly. Do not derive `Overall note` mechanically from the Chinese characters.
