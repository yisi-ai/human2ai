---
name: human2ai
description: Collaborate through local Human2AI design sessions, its style library, and its CLI. Use in a consumer project containing .human2ai/integration.json to inspect, edit, refine, review, or undo design work; to draw a reference picture as editable scene or editorial composition (“把这张图的构图画到画布上”); to project existing UI into a layout canvas (“把 UI 放到画布上让我修改”); to model in the consumer project using a style and 3D spatial guidance; or to reuse a visual style. The consumer project's Agent owns downstream implementation.
metadata:
  version: "0.1.4"
---

# Human2AI

Use Human2AI as the shared design-intent workspace. The user primarily edits and reviews in the browser. Use the CLI against the same typed session, then perform any downstream implementation in the consumer project yourself.

## Choose the operation channel

Default to the CLI for service checks, session discovery, capture reads and edits, state changes, refinement, asset access, and preview export. An open Human2AI page is not a prerequisite. Read structured captures to inspect document contents; do not scrape the page or simulate clicks and drags for operations the CLI supports.

Use Chrome MCP only when the task actually requires browser interaction, such as reproducing an interaction bug or exercising a consumer interface state that CLI data and exported artifacts cannot verify. Explain the interaction being checked before invoking it. Connecting to Human2AI, saving a canvas, or visually inspecting a static result alone does not require Chrome MCP. Export previews with the session's CLI operations and view the local image; rasterize SVG locally when the image viewer needs a bitmap. If that visual inspection is unavailable, report the limitation instead of automatically switching to Chrome MCP.

## Resolve the local integration

Read `.human2ai/integration.json` from the consumer repository before invoking the CLI. Execute its `runner` as an argument array and append the Human2AI arguments shown below. Do not assume that `human2ai` is globally installed, install a registry package, or access the Human2AI SQLite database directly.

Run the integration checks from the consumer repository root:

```text
<runner> integration doctor --root <consumer-root>
<runner> service status
```

When `integration doctor` returns `update-available`, run `<runner> integration sync --root <consumer-root>` immediately and continue. A copied Skill is replaced only when its installed digest still matches the managed version. If synchronization reports `INTEGRATION_CONFLICT`, do not overwrite the consumer copy; report the changed path. A linked Skill already reflects source edits, while `sync` only refreshes its recorded digest.

If the integration config is missing, stop and tell the user that this repository has not been connected to its local Human2AI source. Do not guess the source path.

## Use the shared style library

The style library is global to the local Human2AI service. Each composition, UI or spatial session can bind one of its styles; the browser and Agent share that binding. Search it when the user asks to reuse a style or when you need to select a style for canvas processing or consumer-project modeling:

```text
<runner> style list [--category <visual|ui|spatial>] [--creator <user|agent>]
<runner> style get --style <style-id>
```

`style get` returns reference image URLs, an optional `previewModel.url`, and the full description. Treat that description as an actionable design specification: layout, proportions, hierarchy, spacing, typography, palette, materials, and decorative treatment as applicable. Inspect available reference images to resolve the visual characteristics. The user's explicit content, functions, and placement requirements take precedence over the style specification.

When a style encountered during Agent work is worth keeping, save it directly as an Agent-created entry; there is no proposal or pending-review state:

```text
<runner> style create --name <name> --category <visual|ui|spatial> --description <specification> --summary <sentence>
<runner> style add-reference --style <style-id> --input <image> --expected-revision <n>
```

For a program-generated 3D model example, follow the model-preview instructions in [spatial modeling](references/spatial-modeling.md#save-a-generated-style-example).

A style may have no reference image, but its design specification must be non-empty. Supply a separate concise sentence capturing its distinctive visual traits (typically 30–60 Chinese characters, maximum 240 characters). Browser prompt copying adds only this sentence, without a model call or the full specification. Keep the sentence consistent when editing the specification. Older entries without a sentence fall back to their first description sentence until edited. The creation entrypoint permanently marks these entries as `agent`; entries created in the browser remain `user` even after Agent edits. Update or permanently delete only when the user requests it or it is otherwise clearly part of the current task:

```text
<runner> style update --style <style-id> --expected-revision <n> [--name <name>] [--category <visual|ui|spatial>] [--description <specification>] [--summary <sentence>]
<runner> style remove-reference --style <style-id> --reference <reference-id> --expected-revision <n>
<runner> style delete --style <style-id> --expected-revision <n>
```

On a revision conflict, read the current entry again and reconcile before retrying. Never attempt to change `creatorType`.

## Create or connect to the shared session

Check the service before starting work. If `service status` returns `SERVICE_UNAVAILABLE`, execute the config's `service.start` as an argument array in a persistent terminal, wait for it to become ready, and retry the status command. Do not append `web` to the CLI runner when `service.start` provides a different local development command.

Use the session identifier supplied by the user or browser when one exists. When the requested work needs a new Human2AI workspace, inspect current projects and sessions before creating only the needed session:

```text
<runner> project list
<runner> session list [--project <project-id>]
<runner> session create --type <image-composition|ui-layout|spatial> --title <title> [--project <project-id>]
```

Reuse a clearly matching project when available. Otherwise create an unassigned session instead of inventing project organization. After creation, use the returned session identifier for both the Agent CLI and browser page.

Connect using the resolved session identifier:

```text
<runner> session connect --session <session-id>
```

Treat the returned `session-connection` JSON as the discovery contract. Read `session.sessionType`, `ui.editUrl`, `capture.kind`, `capture.latest`, `capture.commands`, `images.commands`, `style.current`, `style.commands`, and `operations`. The command fields are argument arrays to append to the configured `runner`; do not hardcode API paths or operations that the connection does not expose.

Use `<runner> session open --session <session-id>` when the user wants the review page opened. If the environment cannot open a browser, provide `ui.editUrl` instead.

## Modify captures immediately

Read the latest saved capture, preserve its schema, apply the requested change, and save it immediately with optimistic concurrency:

```text
<runner> capture list --session <session-id>
<runner> capture get --session <session-id> --kind <capture-kind> --revision <n>
<runner> capture save --session <session-id> --kind <capture-kind> --input <document.json> --expected-revision <n>
```

Do not create proposal, approval, or staging states. A successful save appends an immutable revision and an open clean browser page displays it. If the service reports `DRAFT_REVISION_CONFLICT`, reconnect, read the new latest capture, reconcile the user's request with it, and save against that revision rather than overwriting it.

Undo the latest Agent change when requested:

```text
<runner> capture undo --session <session-id> --kind <capture-kind> --change-revision <n> --expected-revision <n>
```

Undo appends the previous document as a new revision; it never deletes history.

## Author a 3D space

For spatial sessions, read [references/spatial.md](references/spatial.md). Create and pose articulated characters, extend custom morphologies, place simple geometry, and edit named output cameras through `spatial apply`. World position and world rotation locks are independent hard constraints. Render and inspect the requested camera after every completed Agent task. Composition nodes can reference those cameras and follow saved scene changes, or keep the current PNG as an independent image node.

When generating an image from a spatial camera, follow that reference's **Camera references for image generation** guidance for interpreting pose intent, correcting anatomical inaccuracies, and excluding guide markings from the generated image.

## Model in the consumer project

When the user asks for final 3D models or a scene in their project, read [references/spatial-modeling.md](references/spatial-modeling.md). Combine the full style specification and reference images with the Human2AI spatial session's layout, scale, pose and camera guidance. Build and review the result using the consumer project's existing tools. A style binding does not alter the guide scene or record completion of external modeling. Use the spatial authoring workflow above only when the guide scene itself needs edits.

## Choose design, planning, refinement or style processing

For requests to design or redesign composition content from focuses or planning guides, follow [Design content from composition planning](references/composition.md#design-content-from-composition-planning). Apply the same interpretation and visual checks when styling, refining or generating from an existing planned composition. With complex guides, especially radial fans, spirals or interacting plans, explicitly map their relationships to visible content before choosing shapes. Check focal placement and directional structure separately; preserving guide data or placing subjects at focuses alone does not fulfill the composition.

For requests to add, inspect or adjust composition planning guides, follow [Shared composition planning](references/composition.md#shared-composition-planning). Read and edit the draft's `plans` through the CLI and save through `capture.commands.save`. Use `composition inspect` and its `planningIntersections` to locate guide crossings and read coordinates for requested placement. Editing guides alone leaves content nodes unchanged.

A request for 精修 or for applying mathematical proportions, symmetry or focal relationships to canvas elements calls for the independent refinement workflow in [references/composition.md](references/composition.md). Do not infer a style request from these terms or bind a library style. Refinement may preserve the source without changes when the Agent finds no justified improvement. Use style processing below only when style application is part of the user’s intent.

## Process a canvas with its style

This workflow applies to composition and UI canvases. For modeling from a spatial session, use the consumer-project workflow above.

For a request to recover the composition of a reference picture, first follow the reference-projection workflow in [references/composition.md](references/composition.md). Abstract the structure that organizes attention, weight, rhythm and space; judge the resulting experience rather than resemblance to object outlines. Choose each shape for its contribution to the whole and explain that contribution in its description. New reference nodes have empty notes, and a new reference draft has an empty overall note. The supplied picture is the visual evidence for that task. Apply a different style only when requested; an existing binding must not silently redesign the recovered composition.

When modifying a styled session, use `style.current.description` and its reference images as design constraints. A request to apply or improve the style calls for actual canvas edits, not just adding a style name or rewriting notes.

If the user names a style, bind it. Otherwise retain an existing binding; when processing calls for a style and none is bound, choose a suitable library entry yourself based on the canvas and the user's goal. `visual` and `ui` are useful search filters, not restrictions on binding. Read candidate specifications before selecting and briefly explain the choice. Use the returned binding commands:

```text
<runner> session style --session <session-id>
<runner> session bind-style --session <session-id> --style <style-id> --expected-revision <session-revision>
<runner> session unbind-style --session <session-id> --expected-revision <session-revision>
```

Reconnect after binding to obtain the current specification and save command. Binding alone does not alter the canvas. Deleting a library style clears its bindings while retaining canvas history.

1. Read the latest capture and the full current specification. If `capture.latest.styleProcessing` exists, read its `resultRevision` as the prior processing baseline and compare it with the latest capture. Preserve subsequent user changes; in particular, do not recreate accents the user removed without a new request.
2. Preserve existing ids, origins, user notes, visible text, content/function and approximate spatial arrangement. Adjust proportions, size, whitespace, alignment, hierarchy and moderate placement/rotation where the specification supports it. Add purposeful decorative elements when helpful. Existing explicit placement requirements win over stylistic preferences.
3. Set new nodes to `origin: "agent"`. Use `annotation` for a short design-role description; for a newly added decoration, its initial `note` should describe the intended visible content so it survives prompt export. Existing notes remain user instructions. Use the session-specific reference below for its coordinate system, allowed geometry and stages.
4. Save the full editable draft using `style.commands.save`, which includes the canvas, style and session revisions:

   ```text
   <runner> capture save --session <session-id> --kind <capture-kind> --input <document.json> --expected-revision <canvas-revision> --style <style-id> --style-revision <style-revision> --session-revision <session-revision>
   ```

   `STYLE_PROCESSING_STALE` or `DRAFT_REVISION_CONFLICT` means the source changed. Reconnect, read the latest canvas and style, and reconcile before retrying. Never remove the style flags to bypass a conflict. Ordinary user edits inherit processing metadata; undo restores the previous document and its processing metadata.
5. Export and inspect the saved revision through the session-specific CLI preview command, then summarize the concrete changes. The draft communicates editable structure and visual intent; carry the full specification into authorized downstream implementation or image generation for details the canvas does not render, such as materials and typography. The browser's copied prompt remains a compact handoff using the single style sentence.

## Route by session type

For SVG icons, decorations, or outlines requested as image-node content, read [references/svg-images.md](references/svg-images.md). Both session types use their existing image nodes for SVG; the user describes the result in language and the Agent authors the source.

- For `image-composition`, read [references/composition.md](references/composition.md) before designing from focuses or planning guides, editing composition planning, drawing a reference picture, canvas processing, refinement or generation-reference work. Interpret light markers as approximately as ordinary shape regions: retain their broad lighting contribution while freely adapting width, length, continuity, edges and strength. User instructions and node notes take precedence. Approximate overall correspondence is sufficient; do not infer fixed-width stripes, strong contrast or exact coverage from the canvas.
- For `ui-layout`, read [references/ui-layout.md](references/ui-layout.md) before modifying the layout document or implementing UI from a capture. Group multi-node controls during projection, and execute its standardization workflow before changing consumer components from canvas geometry.
- For a future session type, use only the capture kind and operations returned by `session connect`. If no reference or operation supports the requested action, report that boundary instead of inventing a command.

Human2AI captures design structure and intent, including SVG image content when requested. After the user's review, decide and complete the appropriate code, asset, article, music, build, or test work in the consumer project under that project's instructions.
