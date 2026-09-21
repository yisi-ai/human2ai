# Composition sessions

The Agent decides which compositional relationships support the user’s intent. Human2AI provides neutral measurements, deterministic relation operations, final relation checks and independent results. Style processing is a separate workflow used only when the request calls for it.

## Draw a reference picture on the canvas

Geometric areas may explicitly set `isLightSource: true` (missing or false means ordinary content). Interpret light markers at the same approximate level as ordinary composition shapes: preserve the intended lighting contribution and broad spatial relationships, not a measured light-patch template. Rectangles suggest band-shaped or extended illumination; circles suggest localized illumination. The drawn width, length, contour and gradient are descriptions, not default output constraints. User instructions and node notes take precedence; otherwise the Agent freely adapts width, length, curvature, continuity, softness and strength to the scene.

An authored band should contribute a band-like or extended lighting tendency, but may be narrower or wider, taper, bend with surfaces, break into patches through occlusion, or blend with other illumination. It need not form a separate complete stripe, remain uniformly wide, pass through an exact point or span the frame. Do not add medium-strong contrast, conspicuous thumbnail visibility, exact coverage or a fixed width merely to prove that the band exists. Keep the broad lighting role without ignoring it altogether. Distinguish a source from the area it illuminates; yellow is only an identification convention. Consider multiple sources individually, while their visible effects may split, overlap or blend naturally.

Generation prompts should describe the lighting intent concisely and leave implementation room, as ordinary regions allow reconstruction, splitting, merging and overlap. Review whether the overall lighting approximately echoes the composition's placement, extension and emphasis, rather than checking every stripe, edge, segment or width. Approximate overall correspondence is sufficient. Tighten only the specific properties explicitly requested by the user. For example, a broad diagonal marker can become a narrower broken wash of light across a face, fabric and background; do not insist on a ruler-like bright rectangle across all three.
Editor and refined canvases retain marker geometry; generation references use borderless falloff with softened edges. Text regions cannot be light sources. Ordinary editing can toggle the property through draft saving; geometric refinement must preserve it. Never infer or overwrite the flag from a note alone.

Requests such as “把这张图的构图画到画布上”, “按参考图画场景构图”, or “把这张海报转成版面构图” ask for an ordinary editable `composition-draft`. Read [composition-projection.md](composition-projection.md) for interpreting the whole-picture effect, selecting geometry by contribution, writing role explanations, and authoring the draft. First understand how attention, visual weight, rhythm and space work together; then abstract those relationships. A layout photo may contribute several important masses, but identifying its objects or tracing their silhouettes is not the goal. Each description explains what the shape contributes and through which relationship. New node notes and the new draft's overall note stay empty. The Agent inspects the image and authors the draft; Human2AI does not call a vision model. Save through `capture.commands.save`, inspect whether the canvas retains the intended structure and experience without excessive detail, and hand it to the user for editing.

This is full draft authoring. `composition apply` below only refines existing geometry and cannot create the recovered regions. A reference picture does not require a style-library entry or an image node on the canvas.

## Design content from composition planning

Use this workflow to create or redesign content from focuses and `plans`, and to
preserve those relationships during style processing, refinement and authorized
image generation. For a request to edit only the guides, use
[Shared composition planning](#shared-composition-planning) and leave content alone.

Read the latest capture, user notes and all active-state plans, including hidden
ones, then inspect the rendered composition. Preserve the user's
`processingSemantic`; ask for Scene or Editorial if it is null. Read planning in
frame fractions and directions in physical geometry as documented below. Treat
focus placement, directional flow, visual weight and negative space as distinct
relationships. Intersections locate crossings; they do not require a subject at
every crossing, and a radial origin is not automatically a focus or a light source.

With complex planning, such as radial fans, spirals or several interacting guides,
make a compact correspondence before authoring: **plan id / relevant line or
relationship → visible content that carries it → expected visual effect**.
Account for every plan's intent, including its interaction with the others; do not
silently discard an inconvenient direction. Keep this reasoning in the working
explanation, with node-specific roles in `annotation`, rather than adding schema
fields or overwriting user notes. User-specified subjects and priorities remain
constraints. When the subject is open, choose one whose structure can express the
planned relationships. Resolve material conflicts with the user if their intent
cannot be retained; do not move their guides to accommodate a convenient subject.

Choose nodes by their contribution to the whole: concentrated weight, directional
extension, repeated rhythm, enclosure or a boundary of negative space. A node may
combine several objects or cover only part of one. Split it when a distinct
relationship would otherwise disappear; merge parts that only improve object
recognition without changing the composition. Do not default to one node per body
part, object or guide line. Use the coordinate and draft format in
[Author a complete draft](composition-projection.md#author-a-complete-draft), with
`origin: "agent"` for new design nodes. Preserve existing identities, notes and
plans within the requested edit scope. Save through `capture.commands.save`, or
`style.commands.save` when applying a style; adding content is full draft authoring.

### Make radial and other guide relationships visible

For each radial plan, read its convergence point and every authored direction
(`angles` for Free, or directions derived from the Uniform fields). Preserve the
recognizable center, principal directions and angular spread of the fan through
actual contours, elongated masses, repeated elements, tonal
boundaries or gaps. Several rays may be expressed by one coherent fan or sequence;
one ray may continue across several shapes. There is no requirement for one node
or a literal straight stroke per ray, or for content to reach every ray's endpoint
at the frame boundary. Curvature, interruption and overlap are
acceptable when the overall directional relationship remains legible. For multiple
radial centers, check each fan and how the fans meet, cross or remain separated.
Correct focal placement does not satisfy a radial plan whose fan is absent or
whose visible directions relate to a different center.

Apply the same reasoning to other plans: a spiral needs a turning progression
around its pole; a triangle needs a corresponding arrangement or directional
envelope; symmetry needs a perceptible relationship across its axis; thirds and
golden-section guides inform placement and division of mass or space. Combined
guides must work as one composition. Not every intersection needs content, and
matching guides does not by itself establish visual quality. Use approximate visual
correspondence unless the user requests exact alignment; do not invent universal
angle tolerances or turn guide marks into decorative artwork.

### Verify the draft and carry the structure into generation

Inspect the saved draft at the original framing before adding detail. Compare it
with the planning overlay to check origins, directions, extent and relationships,
then inspect content without the overlay to check whether the intended structure
is visible on its own. If needed, hide plans in a temporary local inspection copy;
preserve their saved geometry and visibility. Judge shape, spacing and contrast,
not only descriptions or metadata. Correct missing relationships before proceeding.

For separately authorized generation, carry the correspondence into the prompt
alongside subject and style: include the relevant guide centers and directions,
their visible carriers, and the spaces or intersections that should remain open.
The generation-reference PNG omits planning lines, so attaching it alone cannot
communicate all planning intent. Keep these relationships explicit in follow-up
edits, including when changing subject size, pose or focal position.

Inspect the generated image against the same relationships at the same framing,
and also without guides at thumbnail scale. Focal placement and directional
structure must both work; attractive detail, a correct node count or a successful
geometry audit cannot substitute for this review. Revise the missing relationship
within the authorized task. If it cannot be achieved or visually checked, report
the specific limitation instead of claiming the planned composition is fulfilled.

## Apply a session style to the editable canvas

Use the style workflow in `SKILL.md` and save a complete draft through `style.commands.save`. This supports proportion changes and new accents. The `composition apply` workflow below remains a separate Agent-directed derivative workflow; explicit ratio and geometry-symmetry rules may resize existing areas, while node identity and content remain intact.

Read the current capture and inspect it with `composition inspect --session <session-id> --revision <n> --preview <preview.svg>`. Preserve the user's explicit `processingSemantic`; when it is `null`, ask the user to choose Scene or Editorial before processing. Keep the frame and existing visible text, ids, user notes and approximate placement. In Scene mode interpret areas as subjects and spatial relationships; in Editorial mode interpret them as typography, imagery and negative space. Apply the style through supported sizes, proportions, placement, rotations, weights and optional agent-origin accents. Do not turn the sketch into a literal inventory of bordered boxes.

Coordinates use the signed world coordinate system below, not pixel values copied from the preview. Validate the saved revision and inspect its preview. The browser can copy the current canvas as a PNG and a prompt with one style sentence. For downstream work, use the full bound specification; a guide-bearing preview SVG is not a generation reference.

## Refine a composition

Refinement clarifies the user's composition through deliberate, optional relationships. Mathematical rules are tools, not mandatory templates or evidence of aesthetic quality. Do not select a convenient operation first and invent a reason afterward. Do not bind a style or rewrite the editable capture in response to a refinement request.

1. Discover current methods and the plan schema with `composition methods`. Read the exact saved revision with `capture get`, then run `composition inspect --session <session-id> --revision <n> --preview <source.svg>` and actually inspect the rendered composition. Reuse the user's explicit `processingSemantic`; when it is null, ask for Scene or Editorial. Re-inspect after their choice. Preserve the exact source fingerprint.

2. Read the composition before deciding to change it. Describe the intended viewing experience, relevant masses, scale contrasts, open space, focal relationships and existing motion. Use visible evidence and user notes; do not assume every shape is a subject, every focus has a rank, or every empty space needs filling. Record uncertainty instead of inventing missing intent. `inspect.guidance` provides neutral angle and perpendicular/forward distances from existing shape axes and the direction line to focuses; these measurements do not prove how viewers will look. Distances use output pixels and angles use physical world geometry, including on portrait or moved frames.

3. State the improvement objective, supporting observations and relationships worth preserving. If the current arrangement already expresses its intent or no justified improvement is identifiable, choose `decision: "retain"` and `operations: []`, with a reason. A retain decision is a valid completed refinement; do not move elements merely to show activity. With unresolved intent that materially changes the choice, discuss it before execution.

4. Author a `composition-refinement-plan` with `version: 2`. Include `objective`, `assessment: { intent, observations, uncertainties }`, `preserve`, `tradeoffs`, `rationale`, `fixedIds`, `focusLinks`, `decision` and `operations`. Arrays may be empty. Each selected operation must include `reason` (the observed issue it addresses) and `expectedEffect` (the intended perceptual improvement), in the user's language. Each operation must support the same overall objective. Name concrete ids and measurements; “make it harmonious” is insufficient. Select only necessary rules; zero, one or several may be appropriate.

   - `fixedIds` locks the listed existing nodes completely. User wording and notes remain unchanged by every operation; the original frame, node identities, shapes and images are preserved. Put other preservation intentions in `preserve`; the Agent must review those visually.
   - `focusLinks: [{ focusId, areaId }]` explicitly associates a focus with a subject. A focus can belong to one area. Moving, resizing or rotating the area carries its focus at its normalized local position; moving a linked focus translates the area. Multiple focuses may belong to one area. Do not infer associations merely from proximity. If linkage would contradict the user's intent, leave it absent.
   - Operations compute geometry, not final illustration outlines. Size changes require an explicit `size-ratio` or geometric `mirror-symmetry`; direction-line rotation requires `focus-flow`. Do not add visible guide marks to the user's content.

5. Explain the concrete plan and obtain user consent in the conversation unless their existing request already authorizes it. The Agent owns that conversation; Human2AI has no separate approval state or confirmation API. Apply using:

   ```text
   <runner> composition apply --session <session-id> --revision <n> --plan <plan.json> --output <run.json> --preview <refined.svg>
   ```

   Execute dependent operations in a deliberate order: establish proportions and subject placement, propagate subject/focus associations, then arrange guidance as applicable. The engine remeasures **every chosen relationship on the final draft**. A later operation cannot silently invalidate an earlier one. `audit.relations` reports before/after/target/error and technical satisfaction; incompatible relations or changed `fixedIds` produce `REFINEMENT_CONSTRAINT` with the affected operation indices. Revise the plan, order, or explicitly conflicting intention; do not repeat a failing plan or overwrite the source to make it fit. This is exact relation validation, not a general constraint optimizer.

6. Require `result.audit.passed` and read every final relation check. Then inspect the final image at the same framing as the source. Does the chosen rule actually strengthen the intended attention, balance, space or flow? Has it harmed a more important relationship or made an incidental mark too prominent? Has changed clipping undermined the subject? Technical satisfaction alone does not answer these questions. Revise the independent result when needed and report the observed outcome and tradeoffs; never claim that the numeric audit proves beauty. A `null` before-value means that relationship was undefined on the source (such as a directional axis before a round mass is elongated).

7. Open or provide `ui.editUrl`. The independent result appears in **Refined / 精修**, with objective, evidence, preservation intentions, tradeoffs and relation measurements. Refinement-audit guides are not rendered and have no display toggle; saved composition `plans` have their own visible overlay as described below. The canvas shows the authored composition elements; relation measurements remain in the result explanation. Guide coordinates in audit data are not artwork or generation-reference content. Original captures are not modified or appended by refinement. New user edits make an older result stale. If the source revision changes while working, reconnect and reconcile the new intent before presenting the result as current.

### Available relationships

Use `composition methods` as the callable contract. Current v2 relationships include the existing focus anchoring, axis relation, rotation alignment and editorial alignment/spacing operations, plus:

| Method | Explicit choice and result |
| --- | --- |
| `frame-placement` | Select `targetId` (area or focus), `axis: x/y`, `alignment: start/center/end`, and `division`. Places the selected center or rotated bounding edge on that frame division. A focus uses its point. |
| `size-ratio` | Select `targetAreaId`, `dimension: width/height/area`, `referenceId` (area or `frame`), `referenceDimension`, and a positive `ratio`. Lengths compare physical unrotated dimensions; areas compare areas. Width/height changes retain the other dimension; an area change scales both dimensions uniformly. Using the same area with width versus height expresses an aspect ratio. |
| `mirror-symmetry` | Select `anchorAreaId`, `targetAreaId`, `axis: vertical/horizontal`, `division`, and `match: position/geometry`. The anchor stays in place; the target is reflected. Full geometry additionally matches size and reflected orientation and requires the same primitive. Different shapes may have positional symmetry. |
| `focus-flow` | Select an existing `sourceId` (area or `direction-1`), `targetFocusId`, and `localAxis: x/y`. Rotate that existing axis toward the focus, retaining its pivot. The direction line uses x; an undirected circle or a focus coincident with the pivot has no meaningful aiming direction. |

`division` accepts `center`, `golden-start`, `golden-end`, `third-start`, `third-end`: respectively 0.5, approximately 0.382, 0.618, 1/3 and 2/3 within the frame. These are optional named choices. A golden ratio is `(1 + sqrt(5)) / 2`, approximately 1.618; always state which measurements it relates. Do not mix area and length dimensions.

Rules need not all be used, and none is compulsory. Mathematics can describe focus placement, symmetry, ratio and guidance, but cannot choose which fits the user's image. Sequentially applying contradictory exact rules does not constitute a coherent plan.

### Compatibility and generation reference

Version 1 plans and stored results remain readable and executable for compatibility. New Agent work uses version 2 so it records intent and validates final relationships. The legacy `strength: "subtle"` is optional and imposes no amplitude limit. Source fingerprint, mode, valid geometry and protected content are still checked. Displacement, rotation, clipping, overlap and visual-center changes are observations, not aesthetic rejection thresholds.

When downstream image generation is authorized, export the saved run through `composition reference --session <session-id> --run <run-id> --output <reference.png>`. Attach the returned image path as a soft spatial map, not line art, and carry the mode-specific interpretation and required typography into the generation instruction. The CLI preview SVG includes guides and outside content and must not replace that PNG.

## Shared composition planning

People and Agents edit the same optional `plans` array in a composition draft.
Read the latest capture, preserve its content and other states, edit `plans`, and
save the complete draft through `capture.commands.save` with the latest revision.
Do not use `composition apply` just to change planning: that command creates a
separate refinement result. Editing a plan must leave all content nodes untouched.
Only change content when the task separately asks for a layout adjustment.

Each plan has a unique `id` within its state (for example `plan-1`), `type`,
and `visible`. All plans contribute to composition intent, including hidden plans.
`visible` only controls editor/inspection display. Planning has no individual notes
or adoption switch; use the draft's overall requirements for user instructions.
Legacy `enabled` and `note` fields are removed when loading earlier drafts.
Preserve existing plans unless the task calls for changes.

In the editor, Shift-click (or Ctrl/Cmd-click) selects multiple plans. Drag a
selected guide or use arrow keys to move the selected movable plans together;
thirds, golden-section and symmetry guides keep their frame-relative positions.
Thirds and golden-section lines do not intercept canvas clicks; select and edit
these plans in the sidebar.
Unselected guides are light gray. The planning header lock disables manual add,
geometry, per-plan visibility and delete controls, without restricting Agent saves.
The header also has a master display icon that hides all planning lines and controls
without changing per-plan `visible` or generation intent; it works while locked.
Both master display and lock are local editor state, outside the persisted draft.

All planning positions are **fractions of the current frame**, measured from its
top-left. They are not the world-unit positions used by content nodes. Clockwise
rotation is measured in physical geometry from the rightward horizontal, so it
stays correct for portrait frames. Supported plan fields are:

| `type` | Additional fields |
| --- | --- |
| `thirds` | `axes`: `both`, `horizontal` or `vertical`. Equal thirds fixed to the frame. New drafts start with a visible `both` plan; existing drafts are not backfilled. |
| `golden-section` | `axes: "both" / "horizontal" / "vertical"`; divisions stay attached to the frame. |
| `symmetry` | `x`, `y` are fixed to `(0.5, 0.5)` on validation. `rotation` snaps to the nearest of eight 45° directions plus the four directions from the frame center to its corners. Corner directions follow the frame aspect ratio, giving twelve positions for non-square frames and eight merged positions for square frames. Pointer and arrow-key controls use the same positions. Only the outer control moves; the center and radius stay fixed. Default 90° is vertical. |
| `golden-spiral` | `x`, `y` locate the convergence pole; `rotation` aims the outer radius; positive `scale` is that radius divided by the shorter physical frame side; `mirrored` reverses winding. Clicking the center dot toggles winding; dragging it moves the pole, and dragging the outer dot rotates/resizes. Radius grows by φ per outward quarter-turn. |
| `triangle` | `x`, `y` locate the center; `rotation` is clockwise from the upright triangle; positive `width` and `height` are the unrotated base width / frame width and perpendicular height / frame height. Both legs always have equal physical length. Dragging the apex rotates and adjusts height; dragging a base corner resizes both sides symmetrically. |
| `radial` | `x`, `y` locate the convergence point. `mode: "uniform"` uses `rotation`, integer `rayCount` (2–36), and `spread` (1–360°); angles are evenly spaced, and a full circle has no repeated terminal ray. `mode: "free"` instead uses `angles`, an array of 2–36 independent clockwise directions in degrees from the rightward horizontal; omit `rotation`, `rayCount` and `spread`, since the count is `angles.length`. Each free ray has its own direction control; the center control moves the entire plan. New radial plans default to uniform with `(0.5, 0.5)`, 0°, 8 rays and 360°. Earlier radial plans without `mode` load as uniform. |

Switching radial planning to Free preserves all current directions. Switching back
to Uniform keeps the convergence point, ray count and first ray direction, then
uses a 360° spread. Increasing the count in Free adds rays in the largest angular
gaps without changing existing directions; decreasing it removes trailing entries.
Drag or nudge a free ray's control to change only that ray's angle. Free directions
are saved in `plans` and included individually in the generated composition prompt.

Example: `{ "id": "plan-1", "type": "golden-spiral",
"visible": true, "x": 0.618,
"y": 0.382, "rotation": 135, "scale": 0.65, "mirrored": false }`.

`composition inspect` exposes active `plans`; its SVG preview renders visible
plans using the same geometry as the browser. Planning guides never enter the
generation-reference PNG. Carry all planning intent into any
separately authorized generation work using the
[content correspondence and visual checks](#design-content-from-composition-planning)
above; do not ask the model to draw the guides.
Each state owns its complete planning array in `layout.plans`. The top-level
array is the active state's editable copy and synchronizes on save, like geometry.
Switching states restores that state's plans; adding/deleting plans affects only
the current state. Existing drafts without `plans` remain valid.
Earlier triangle `points` are converted on load by retaining the base and
projecting the apex onto its perpendicular bisector. Earlier `thirds` plans are
retained as ordinary planning; there is no separate nine-cell grid overlay.

### Read guide intersections

Both local and saved-revision `composition inspect` results include
`planningIntersections`. They are derived from the active state's planning geometry,
including hidden plans, and contain isolated crossings inside or on the frame.
The editor's visibility and lock controls do not affect this data. Empty planning
or no crossings produces an empty array. Crossings within a plan are included,
such as the four thirds-grid points, triangle vertices and radial convergence.
Coincident points merge their sources. Continuous overlaps have no unique point
and are omitted; a third line crossing overlapping lines can still yield a point.

Each intersection provides:

- `id`: an inspection-local identifier, ordered by physical Y then X. Re-inspect
  after geometry changes; these ids are not persistent anchors.
- `framePoint`: fractions of the current frame from its top-left, in `[0, 1]`.
  Use this coordinate system for planning positions.
- `canvasPoint`: signed canvas coordinates in the same units as content-node
  `x` and `y`, ready for requested node placement. These are not preview pixels
  or output pixels; one canvas unit is 1200 physical units horizontally and 800
  vertically. Frame position and size are already accounted for.
- `sources`: all participating `{ planId, type, lineId, visible }` records.
  Numbering starts at 1. Grid line ids are `vertical-1/2` from left to right and
  `horizontal-1/2` from top to bottom. Symmetry uses `axis`; a spiral uses `spiral`.
  Triangle `edge-1/2/3` follows apex → left base → right base → apex before rotation.
  Radial `ray-1`, `ray-2`, etc. follow uniform generation order or the free `angles`
  array order.
- `precision.kind`: `exact` for analytical straight-segment intersections, subject
  to floating-point tolerance; `approximate` when a golden spiral participates.
  Spirals use the same 240-segment polyline as the canvas and CLI preview.
  `precision.maxCurveDeviationPx` bounds the curve-to-polyline deviation in output
  pixels (zero for straight lines). It is **not** a bound on intersection-position
  error, which can be larger near a tangent. Coincidence and frame-boundary checks
  use a tolerance of `1e-7` physical canvas units.

For a request such as placing a focus at a golden-section/radial crossing, find
the entry with the requested `planId` and `lineId` sources, copy its `canvasPoint`
to that focus's `x` and `y`, and save the complete capture against the inspected
revision. Preserve unrelated content and plans. Do not write these derived facts
into the draft. This is a one-time placement; later guide edits do not move nodes.

## Canvas stacking order

Preserve the optional draft-level `layerOrder` array when editing captures. It lists content node ids from back to front, independently of array numbering, geometry, visual weight or scene depth. Without it, the existing type-based draw order applies. Keep ids unique; remove deleted ids and append new ids after the saved order. Browser layer actions preserve selected nodes’ relative order. UI groups move together in this order, which is shared across motion states. Frame boundaries, guides and selection controls are outside the content order. Preview and SVG/PNG output follow this order.

Composition captures may include `states` and `activeStateId`. Preserve both when editing. All states share the top-level node identities, content and metadata; only frame geometry, node geometry and layer order vary. Top-level geometry is the active state's editable layout and is synchronized to its snapshot when validated or saved. Edit the top-level geometry to change the active layout; preserve other state layouts. State snapshots contain no independent node content. Older captures without these fields represent one state. Browser copy actions use the active layout; states do not imply animation.
