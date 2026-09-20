# UI layout sessions

Use `ui-layout-draft` for a `ui-layout` session. Use the unified Capture CLI for reading and saving revisions, `ui-layout.render@1` for preview export, and `ui-layout.standardize@1` for geometry standardization. Discover these operations through `session connect`; do not run `composition` commands.

## Export and inspect a saved state

After editing, use the saved revision and inspect the resulting local preview without Chrome MCP:

```text
<runner> ui-layout render --session <session-id> --revision <saved-revision> --state <state-id> --output <preview.png>
```

Use a `.svg` output filename for a self-contained vector preview. Both formats embed the selected state's image assets, preserve crop and layer order, omit hidden nodes, and clip to the interface frame. They contain the abstract regions, notes, text and images rather than editor controls or a fully styled consumer UI. The command is read-only and returns `artifact.path`, MIME type, dimensions, the exact revision/fingerprint and the selected state metadata.

Read state ids, names and order from the capture's `stateTabs`; older captures use `start` followed by `stages[].id`. Pass the stable id to `--state`, not the display name. If omitted, the first state in display order is exported, including when `start` has been deleted. Export each state relevant to the task separately. Unknown or deleted state ids fail instead of falling back to another state. Open the PNG with the available local image viewer to check placement, text, visibility and clipping; opening the Human2AI page is unnecessary for this check.

## Capture user-perceived layout intent

A UI layout draft is a flat spatial sketch of what users can see, read, recognize, or interact with. It is not a DOM tree, component tree, CSS layout model, or inventory of framework components.

- Include only the key elements needed to communicate the interface's task, visual hierarchy, and spatial relationships: visible text, images, controls, content footprints, and independently perceptible regions or surfaces.
- Omit implementation-only wrappers, layout grids, stacks, spacing boxes, providers, and parent rectangles that merely repeat the bounds of their visible children.
- Treat a rectangle as an approximate content footprint or perceptible visual surface, not as an instruction to render a border, card, or container. Express hierarchy through relative position, scale, visual weight, typography, whitespace, and overlap instead of drawing every implementation layer.
- Include a parent region and its children only when each communicates distinct user-perceived meaning. A boundary, background, elevation, clipping, scrolling behavior, or interaction can make the parent independently perceptible; code ownership or nesting alone cannot.
- Put non-visual grouping and implementation constraints in `overallNote`, node notes, or annotations instead of creating another rectangle. Prefer the smallest set of elements that preserves the user's intended experience.

Use `groups` for persistent selection and movement relationships. A group has a stable `id` and `itemIds` containing at least two existing rectangle, text or image ids, for example `{"id":"group-save-button","itemIds":["save-surface","save-label"]}`. Each node belongs to at most one group; groups cannot contain groups and their ids must not collide with node ids. Group membership is shared across motion stages while geometry stays stage-specific. Old captures without `groups` load as an empty array.

When projecting a visible control made from several nodes, group its surface, static label and any icon so the user can move the control immediately. Keep the static text individually editable. Group only elements that should move as one visible unit; do not group all descendants merely because they share a code component. Groups add no visible surface and prescribe no implementation wrapper. The browser creates and dissolves groups through the canvas context menu. Preserve group ids and membership through subsequent edits; when removing nodes, remove their memberships and dissolve groups with fewer than two members.

For example, an implementation tree such as `AppShell > Main > Card > Stack > Button` normally becomes the key visible content and button. Include the card only when its surface is perceptible and important to the layout; omit `AppShell`, `Main`, and `Stack` when they only arrange descendants.

The interface frame defines the intended output area, not a movement boundary. Nodes may remain anywhere on the infinite canvas, including entirely outside the frame. Preserve parked nodes and their visibility flags in captures. A copied static prompt includes only visible nodes whose bounds overlap the frame; a copied motion prompt includes nodes with visible overlap in either the initial or final state and preserves their entering or exiting geometry. Partially overlapping nodes keep their full geometry. Nodes that only touch a frame edge without occupying any area inside are outside for prompt export.

## Apply the bound style

Use the shared style-processing workflow in `SKILL.md`. Read the full specification and reference images, preserve content, functions and approximate arrangement, then improve proportions, whitespace, alignment, text scale and visual weights. Add a small number of purposeful `origin: "agent"` accents where the style calls for them, using perceptible nodes under the rules above. Retain existing origins and user notes. Carry typography, colors and materials into downstream UI implementation because the abstract canvas does not render a complete UI theme.

Preserve the existing stage structure and motion intent. When resizing, moving or adding a node, reconcile its corresponding states in every stage; do not silently flatten motion into a static draft. Save through the connection's `style.commands.save` so the browser receives an editable, undoable version with the processing context.

## Project an existing UI onto the canvas

When the user asks to put the current, old, or existing project UI onto the canvas so they can modify it, treat that request as a reverse projection into an ordinary `ui-layout-draft`. Requests such as “把 UI 放到画布上让我修改”, “把当前页面画到 Human2AI 画布”, or “把旧界面转成布局草图” invoke this workflow without requiring the user to name the session type or Capture commands.

Resolve the target page from the user's current task and the consumer project. If several pages or states are equally plausible and the choice would materially change the draft, ask which one to project. Inspect the UI implementation and, when useful and available, its local rendered result. The saved canvas must contain only the abstract layout evidence described below; never place a screenshot, DOM tree, component tree, source path, or source code on the canvas.

- Use rectangles for dynamic content, media footprints, controls, groups, and independently perceptible regions whose approximate size or placement matters.
- Use text nodes for visible static product copy. Keep imported static text editable so a user text change expresses a requested copy change in the existing UI.
- Collapse repeated dynamic rows or cards into the smallest region that preserves their macro layout. Do not project runtime example values as static text.
- Assign stable item ids and concise semantic types. Put a human-readable explanation of what each projected node represents in `annotation`; keep its initial user-editable `note` empty.
- Set `origin` to `import` for every node derived from UI that already exists in the consumer project. Use `agent` only for a new layout node proposed by the Agent, while nodes created in the browser use `user`. Preserve origin when a node is edited.
- Do not add image nodes merely to reproduce the existing UI. Represent image, chart, video, or other dynamic media areas as rectangles with a clear node description.

Create or reuse the smallest clearly matching `ui-layout` session, save the projected draft through the normal Capture command, retain the returned revision as the comparison baseline, and open or provide the session review page. When the request is to place the UI on the canvas “让我修改”, stop after this handoff and wait for the user; do not modify the consumer UI yet.

After the user says the canvas is ready and asks to update the project, read both the retained projection revision and the latest revision. Compare stable item ids and apply the accepted macro intent in the consumer project:

- a missing `import` node requests removal of the represented existing UI;
- changed geometry or visibility requests a corresponding layout or visibility change without prescribing a particular CSS mechanism;
- changed text content on an `import` text node requests a change to the existing static copy;
- a `user` node requests new UI, while an `agent` node remains an Agent-proposed addition;
- node notes are user instructions and must be preserved and considered together with the structural differences;
- read-only node descriptions identify nodes but are not themselves user change requests.

Before changing consumer components from canvas geometry, complete the standardization workflow below. Implement the result using the consumer project's own supported viewport scope, layout, components, localization rules, tests, and verification. Do not reproduce approximate canvas coordinates with rigid absolute positioning unless the actual interface constraints require it.

Read the exact latest `document`, make the requested change while preserving its schema and existing unrelated rectangles, texts, images, annotations, notes, and stages, then save it against the latest revision. Apply the selection rules above to new elements and to any requested reconstruction; do not silently remove unrelated existing elements. Human2AI records the layout intent but does not implement the interface in the consumer project.

After saving, open or provide the session review page. Once the user has reviewed the result, standardize it before translating the accepted intent into the consumer project's own components, routing, state, styling, tests, and build process as the project requires.

## Standardize geometry before implementing a canvas

This is required whenever implementing or updating consumer UI from a UI-layout capture, including after user dragging or dimension edits. Reading a capture or handing off an editable projection alone does not require it. Human2AI cannot enforce changes in an external repository; the consumer Agent must complete this step before editing its components.

1. Read the latest capture and compare it with the projection baseline, when available, before standardizing. Preserve the raw revision as evidence of user changes. Save the exact latest `document` to a local JSON file, keeping ids, origins, notes, content, images, visibility, parked nodes, groups and stages.
2. Identify nearly aligned edges or centers from the user's intended rows, columns and controls, considering notes and the original interface. A coordinate difference alone does not establish alignment intent. Create an alignment plan with the latest capture's `fingerprint` as `sourceFingerprint`. Use actual stage ids (`start` for the base state); choose relationships independently in each stage so motion remains intentional. Group ids and node ids are accepted, but any member of a group resolves to the whole group. An empty `alignments` array is appropriate when there is no supported nearby relationship.

   ```json
   {
     "sourceFingerprint": "<latest-capture-fingerprint>",
     "alignments": [
       { "stageId": "start", "axis": "x", "edge": "start", "anchorId": "group-primary-button", "itemIds": ["group-secondary-button"] }
     ]
   }
   ```

   `axis` is `x` or `y`; `edge` is `start`, `center` or `end` (left/center/right or top/center/bottom). Each operation moves targets toward the corresponding anchor edge or center. Prefer a single consistent anchor per relationship. Text envelopes use the same deterministic estimate as canvas export; avoid inferring typographic baseline or optical alignment from this estimate.
3. Execute the command discovered in `session connect` with separate source and output files, adding the plan:

   ```text
   <runner> ui-layout standardize --input <document.json> --output <standardized.json> --plan <alignment-plan.json>
   ```

   The command rounds frame geometry, frame-relative node positions, dimensions and font sizes to integer canvas pixels in every stage. Source-image crop fractions remain unchanged. Selected alignment relationships then move each target, or its entire group, by at most 3 pixels on each axis, including cumulative movement. Center alignment retains integer positions and may differ by half a pixel when widths or heights have different parity. Unselected relationships receive rounding only. The command writes a validated document and prints a report with source/result fingerprints and before/after geometry; it does not save the session or change project code. Omitting `--plan` performs rounding only.
4. Inspect the report against the raw user changes and explicit notes. If a plan is stale, exceeds the tolerance or contains conflicting alignments, reconcile the plan and run it again. Do not enlarge the tolerance or bypass validation. A larger intended layout change belongs in an explicit canvas edit before standardization. Save the standardized document through the normal Capture command against the latest revision when geometry changed; this makes the result visible and undoable. On a revision conflict, reread and standardize the new latest capture. If the report has no changes, retain the current revision without creating a redundant version.
5. Implement from the standardized result together with the original user diff. Prefer existing layout rules, component sizes and spacing tokens. Determine whether a width means a fixed size, content sizing or available container width from context; do not copy raw canvas floats into CSS or remove legitimate percentages, relative units or image crop fractions. Standardization refines approximate geometry without replacing the consumer project's layout system. Once downstream implementation is authorized, the small standardization changes do not introduce a separate approval gate.

## Canvas stacking order

Preserve the optional draft-level `layerOrder` array when editing captures. It lists content node ids from back to front, independently of array numbering, geometry, visual weight or scene depth. Without it, the existing type-based draw order applies. Keep ids unique; remove deleted ids and append new ids after the saved order. Browser layer actions preserve selected nodes’ relative order. UI groups move together in this order, which is shared across motion states. Frame boundaries, guides and selection controls are outside the content order. Preview and SVG/PNG output follow this order.
