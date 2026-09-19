# Composition sessions

The Agent decides which compositional relationships support the user’s intent. Human2AI provides neutral measurements, deterministic relation operations, final relation checks and independent results. Style processing is a separate workflow used only when the request calls for it.

## Draw a reference picture on the canvas

Geometric areas may explicitly set `isLightSource: true` (missing or false means ordinary content). Interpret light markers at the same approximate level as ordinary composition shapes: preserve the intended lighting contribution and broad spatial relationships, not a measured light-patch template. Rectangles suggest band-shaped or extended illumination; circles suggest localized illumination. The drawn width, length, contour and gradient are descriptions, not default output constraints. User instructions and node notes take precedence; otherwise the Agent freely adapts width, length, curvature, continuity, softness and strength to the scene.

An authored band should contribute a band-like or extended lighting tendency, but may be narrower or wider, taper, bend with surfaces, break into patches through occlusion, or blend with other illumination. It need not form a separate complete stripe, remain uniformly wide, pass through an exact point or span the frame. Do not add medium-strong contrast, conspicuous thumbnail visibility, exact coverage or a fixed width merely to prove that the band exists. Keep the broad lighting role without ignoring it altogether. Distinguish a source from the area it illuminates; yellow is only an identification convention. Consider multiple sources individually, while their visible effects may split, overlap or blend naturally.

Generation prompts should describe the lighting intent concisely and leave implementation room, as ordinary regions allow reconstruction, splitting, merging and overlap. Review whether the overall lighting approximately echoes the composition's placement, extension and emphasis, rather than checking every stripe, edge, segment or width. Approximate overall correspondence is sufficient. Tighten only the specific properties explicitly requested by the user. For example, a broad diagonal marker can become a narrower broken wash of light across a face, fabric and background; do not insist on a ruler-like bright rectangle across all three.
Editor and refined canvases retain marker geometry; generation references use borderless falloff with softened edges. Text regions cannot be light sources. Ordinary editing can toggle the property through draft saving; geometric refinement must preserve it. Never infer or overwrite the flag from a note alone.

Requests such as “把这张图的构图画到画布上”, “按参考图画场景构图”, or “把这张海报转成版面构图” ask for an ordinary editable `composition-draft`. Read [composition-projection.md](composition-projection.md) for interpreting the whole-picture effect, selecting geometry by contribution, writing role explanations, and authoring the draft. First understand how attention, visual weight, rhythm and space work together; then abstract those relationships. A layout photo may contribute several important masses, but identifying its objects or tracing their silhouettes is not the goal. Each description explains what the shape contributes and through which relationship. New node notes and the new draft's overall note stay empty. The Agent inspects the image and authors the draft; Human2AI does not call a vision model. Save through `capture.commands.save`, inspect whether the canvas retains the intended structure and experience without excessive detail, and hand it to the user for editing.

This is full draft authoring. `composition apply` below only refines existing geometry and cannot create the recovered regions. A reference picture does not require a style-library entry or an image node on the canvas.

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

7. Open or provide `ui.editUrl`. The independent result appears in **Refined / 精修**, with objective, evidence, preservation intentions, tradeoffs and relation measurements. Mathematical rule guides are not rendered and have no display toggle. The canvas shows the authored composition elements; relation measurements remain in the result explanation. Guide coordinates in audit data are not artwork or generation-reference content. Original captures are not modified or appended by refinement. New user edits make an older result stale. If the source revision changes while working, reconnect and reconcile the new intent before presenting the result as current.

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

## Canvas stacking order

Preserve the optional draft-level `layerOrder` array when editing captures. It lists content node ids from back to front, independently of array numbering, geometry, visual weight or scene depth. Without it, the existing type-based draw order applies. Keep ids unique; remove deleted ids and append new ids after the saved order. Browser layer actions preserve selected nodes’ relative order. UI groups move together in this order, which is shared across motion states. Frame boundaries, guides and selection controls are outside the content order. Preview and SVG/PNG output follow this order.

Composition captures may include `states` and `activeStateId`. Preserve both when editing. All states share the top-level node identities, content and metadata; only frame geometry, node geometry and layer order vary. Top-level geometry is the active state's editable layout and is synchronized to its snapshot when validated or saved. Edit the top-level geometry to change the active layout; preserve other state layouts. State snapshots contain no independent node content. Older captures without these fields represent one state. Browser copy actions use the active layout; states do not imply animation.
