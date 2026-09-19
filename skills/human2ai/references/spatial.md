# Authoring 3D spaces

A `spatial` session owns an editable scene, independent of composition and UI sessions. Characters, simple objects, and multiple named output cameras share that scene. The browser's orbit view is temporary; moving a character never reframes an output camera.

Characters, primitive objects, output cameras and observation boxes may carry a `note` with user instructions. Read it with the entity's ID, name and geometry when interpreting the scene; a placeholder's note can explain the real object it represents or required framing. Missing or empty notes mean no instructions. Preserve notes when editing other properties. To update a note, use the corresponding `put-character`, `put-object`, `put-camera` or `put-camera-box` with the current entity and changed `note`; use an empty string to clear it. Notes are saved and undoable with the scene, included in `inspect`, and never drawn into reference PNGs.

## Connect, inspect, edit, review

Use the runner and API origin discovered by the parent skill. Start with `session connect --session <id>` and `capture list --session <id>`. A new space has revision 0 and a default `camera-1`. For an existing revision:

```text
<runner> spatial methods
<runner> spatial inspect --session <id> --revision <n> --output inspection.json
<runner> spatial apply --session <id> --revision <n> --input operations.json --output saved.json
<runner> spatial render --session <id> --revision <saved-revision> --camera <camera-id> --output camera.png
```

`methods` returns the complete draft schema and closed operation schema. `inspect` includes the draft and each joint's world position and each bone's upstream pivot and world rotation. `apply` expects a JSON **array** of operations and the latest revision; revision 0 is accepted for a new space. All operations form one atomic change. Initial authoring also creates an empty baseline so it can be undone. Use the returned revision, not `n + 1`. `capture undo` restores a prior document as a new revision. A 409 means reread the latest state and reconcile the user's intervening edits; never silently overwrite it.

After completing an Agent task, open the rendered PNG with an available image viewer. Check silhouette, occlusion, framing, and the requested side/front/high/low angle. Numerical inspection alone is insufficient. Report any unsatisfied constraint. Render each requested output camera; do not present the temporary edit view as the result.

## Camera references for image generation

`spatial render` accepts `--pass color|structure|depth|skeleton`; omission keeps the ordinary color PNG. `spatial methods` exposes `renderPasses`. Export all references using the **same revision and camera**:

```text
<runner> spatial render --session <id> --revision <n> --camera <camera-id> --pass color --output camera.png
<runner> spatial render --session <id> --revision <n> --camera <camera-id> --pass structure --output structure.png
<runner> spatial render --session <id> --revision <n> --camera <camera-id> --pass depth --output depth.png
<runner> spatial render --session <id> --revision <n> --camera <camera-id> --pass skeleton --output skeleton.png
```

The HTTP camera PNG route accepts the same optional `pass` query alongside `revision`. Rendering is read-only. Color, structure and depth share dimensions, projection, framing and surface visibility. Color keeps the camera's background/transparency and includes subtle skin-colored finger joint creases, also visible on the editor model. These creases follow the posed skin and scene occlusion; they do not intercept body-part selection. Structure is dark visible contours and surface-following palm-side finger joint arcs on white; it excludes editor rig overlays, hidden finger lines and skin-module boundaries. The lowest crease next to the palm is omitted on every digit: fingers retain the PIP/DIP lines and the thumb retains only its IP line. Depth is an opaque grayscale reference for **all visible characters and objects**: near is white, far is dark, no surface is black. Values 1–255 map one shared linear camera-space range across visible surfaces; a flat-depth scene is white, an empty scene is black. It is a relative 8-bit guidance image, not a metric depth file; a very deep scene can compress small finger depth differences. Do not normalize different objects separately or draw joint lines onto the depth map.

Skeleton projects the character's actual posed bone segments, joint markers and head outline, including fingers and added limbs, through the same camera and clipping planes. Anatomical left is blue, right is orange, and central parts are neutral. It uses a pale opaque background and omits skin, solid scene objects and lighting. Bones remain visible through surfaces: this schematic is not evidence of surface occlusion or a depth map. Use the canonical `--pass skeleton` renderer instead of drawing a separate approximate rig. All four passes keep the same dimensions, projection and framing; only color, structure and depth share surface visibility.

In the workspace, use the camera or observation-box preview's four-option reference selector and PNG download. The chosen representation is transient, and pending/failed saves do not offer a stale camera download. Composition live-camera nodes continue to use color. No generation model or ControlNet pipeline is installed by this export feature.

When preparing an image-generation prompt, identify each input by role: color communicates the overall action and camera composition, structure helps interpret joints and occlusion, depth helps interpret relative distances and foreshortening, and skeleton communicates joint placement and articulation independently of the model's surface. These are **intent references**. The mannequin's face, body shape, skin, muscles and material are not appearance requirements; use the user's requested subject and style, or design an appropriate appearance when those are left open. Skeleton colors, circles and head outlines are also guides and must not appear on the generated subject.

**Explicitly explain the guide markings in every prompt using spatial references.** Lines across fingers indicate joint locations and finger segments. Lines, seams, segmented shapes and simplified forms around feet, chest, waist and other body parts likewise indicate anatomy and placement. They are not markings to reproduce on the final subject. Do not transfer black joint lines, painted bands, segmentation seams, mannequin surfaces or depth-map tones into the generated image. Reconstruct continuous, natural anatomy, skin and clothing appropriate to the requested style; normal skin folds and clothing seams should arise naturally rather than trace the reference guides. Apply this interpretation even when using only the ordinary color reference.

Describe the **approximate action**, the important gesture or contact relationships, and the broad camera direction and framing. Users may leave inaccurate joint angles, proportions, balance or finger overlap while posing. Allow the generator to correct those inaccuracies into a plausible, comfortable or dynamically balanced action while keeping the intended gesture recognizable. Preserve meaningful contacts and front/back relationships, adjusting incidental overlap when needed for coherent anatomy. Avoid instructions to match exact screen coordinates, joint angles, every contour or the entire silhouette, and avoid prioritizing pose fidelity over natural anatomy. Require stricter matching only when the user explicitly asks for that specific relationship or detail. These corrections belong to the generated image; they do not authorize edits to the saved spatial pose or camera.

Review the result for a recognizable action, broadly consistent viewpoint, plausible joints, balance and contact, coherent fingers and clean body surfaces. Correct visible guide-line artifacts, fused digits or implausible articulation; accept small pose and framing differences that improve naturalness instead of forcing a pixel-perfect match.

## Six-view camera boxes

For ambiguous finger overlap, keep the ordinary camera as the **main composition reference** and add an observation box as auxiliary pose evidence. A box is a saved cubic crop, with six orthographic cameras on its faces looking **inward**. It is not an outward environment cubemap. The same saved scene revision drives every view. The box clips all geometry outside its six planes, including foreground occluders; any geometry still inside the volume remains visible. Cut surfaces at the crop boundary are reference artifacts, not anatomical endpoints.

Create a box and fit it in one `spatial apply` batch:

```json
[
  { "type": "put-camera-box", "box": {
    "id": "hands-reference", "name": "Hand reference",
    "position": [0, 1.2, 0], "rotation": [0, 0, 0],
    "size": 0.4, "resolution": 512
  } },
  { "type": "fit-camera-box", "id": "hands-reference", "region": "hands" }
]
```

`put-camera-box` creates/replaces the full box without changing anatomy or the ordinary cameras. `fit-camera-box.region` accepts `scene` (all posed character meshes and solid objects) or `hands` (all palms/fingers, including custom limbs, plus framing margin). Fit retains box rotation; an empty target leaves the box unchanged. Fit is an explicit action, not a tracking constraint. Preserve other fields when adjusting position, XYZ rotation in degrees, or edge length. Rotate slightly and inspect again if important fingers align in several faces. `remove` deletes the box. `draft.cameraBoxes` may be omitted, has at most 24 entries, and shares scene-wide unique IDs. Edge length is 0.05–1000 metres; each square tile is 128–1024 integer pixels. The box does not count toward the requirement to retain one ordinary camera.

```text
<runner> spatial render --session <id> --revision <n> --box hands-reference --output hands-sheet.png
<runner> spatial render --session <id> --revision <n> --box hands-reference --view top --pass structure --output hands-top.png
<runner> spatial render --session <id> --revision <n> --box hands-reference --view sheet --pass depth --output hands-depth.png
```

`--camera` and `--box` are mutually exclusive. `--view` requires `--box` and accepts `sheet` (default), `front`, `back`, `left`, `right`, `top`, `bottom`. Export individual PNGs by running the command for each face. The sheet is 3×2: front/back/left, then right/top/bottom. Each tile has a 28 px English direction/axis label above it, with 12 px dividers between tiles so cropped limbs do not appear connected across views. Directions refer to the **box-local axes**, not the character's anatomical left/right: front +Z, back −Z, left −X, right +X, top +Y, bottom −Y. In the top image, local −Z points up; in the bottom image, local +Z points up. All faces use the same metric scale. Color preserves transparency; structure/depth use their usual white/black backgrounds, and skeleton uses its pale opaque background with bones visible through surfaces. All four passes support both sheets and individual faces. Box depth maps 0 to `size` metres from each face using a fixed shared linear range, unlike ordinary cameras' visible-surface normalization.

The HTTP route is `GET /api/v1/sessions/:sessionId/spatial/camera-boxes/:boxId.png?revision=<n>&view=sheet&pass=color`. Render is read-only and revision-addressed; box edits are saved and undoable through the existing draft history. `session connect` discovers `spatial.render-box@1`; `spatial methods` exposes the closed operation schemas, `cameraBoxViews`, and `cameraBoxGuidance` (canonical wording: `spatial.cameraBoxGenerationGuidance` in both locale resources).

When generating, export the main camera and auxiliary boxes from the **same revision**. Include the returned `cameraBoxGuidance` in the prompt: the main camera determines composition; the sheet shows the same subjects at one moment from six directions, solely to resolve occlusion, digit ownership and approximate flexion. Request one final image, with no contact-sheet layout, duplicate subjects, direction labels, or joint/body markings. Preserve gesture intent while allowing natural anatomical corrections. Inspect the six views yourself before generation; start with the main camera plus one hand sheet, adding full-space depth or an informative full-resolution face when useful. More views do not guarantee correct fingers, and cannot repair an impossible underlying pose automatically.

## Character model styles

`appearance` is a saved per-character style: `quaternius` (the existing anatomical surface, the default) or `geometric` (a procedural mannequin). To add the new style, include `"appearance": "geometric"` in `add-character`. To switch an existing actor, inspect it and submit `put-character` with its full existing fields and only `appearance` changed. This keeps its joint positions, bone angles, limits, position/rotation pins, proportions, body type and extra limbs exactly intact. The change is saved and undoable; `set-proportions`, hand posing and pose reset retain the selected style. Do not replace the rig to change its rendering style.

Geometric mannequins have blue-gray spherical joints, cylinders connecting joint centers, rigid box palms and feet, and ellipsoid heads with only two dark eyes. Body surfaces follow the actor color. Geometric fingers use stable identity colors: thumb orange, index blue, middle green, ring purple, little pink; both hands and cloned hands share this mapping. Finger joint balls use a lighter shade of the same color, and editor selection brightens the existing hue. These colors remain pose guides rather than requested skin or clothing colors. The terminal head-top and toe landmarks belong inside their solid forms rather than separate hinge balls; fingertips remain rounded. Every articulated finger segment follows the same anatomical axes and limits as the human model. Joint spheres select positional controls, while cylinders, palms, feet and heads select bone rotation. The mannequin itself provides selectable geometry, so the editor does not duplicate its visible rig with an extra helper overlay.

Body type still selects the existing male/female anatomical rig dimensions. Head count and the torso/leg split control the same joint positions; neck length moves the head, palm size and finger length remain independent, and foot size grows the box with the shared mild ankle lift. Cloned arms, hands and heads render from their actual bone hierarchy. No downloaded mesh or skin deformation is used for this style. All camera and observation-box passes use the same scene geometry; skeleton remains a separate schematic PNG pass. For image generation, describe the balls, cylinders, blocks, eye dots and their colors as pose/anatomy guides, not a requested robot or toy appearance unless the user explicitly wants one.

## Skeleton and constraint semantics

Coordinates use a right-handed world: X right, Y up, Z toward the default character's front. Units are metres. Rotations are XYZ Euler **degrees**. Draft version 2 has separate `joints` and `bones`. A joint has a parent-relative rest `offset`, a positional lock, and no rotation control. Each non-root joint has exactly one incoming bone whose `startJointId` is its parent and whose `endJointId` is itself. The bone rotates **before** its endpoint offset is translated: its pivot is the upstream joint. `move-joint.position` is a **world** target; `rotate-bone.rotation` is **local** to the upstream joint frame. Inspect before editing rather than guessing IDs.

`lock-joint.position` pins a world point. `lock-bone.rotation` pins a world orientation while allowing the segment to move. Other controls preserve both types of pin; lengths are fixed during posing. The bounded numerical solver reports `constrained: true` for an unreachable target, returning the best feasible pose it found or the original pose, without a global-optimum guarantee. Never stretch or silently unlock to bypass it.

Every bone has independent `limits.min` and `limits.max` XYZ arrays. Use `set-bone-limits` explicitly to configure these; the bounds must contain both the current rotation and `restRotation`. Pose edits cannot alter standard topology or bone lengths. Standard ranges are provisional anatomical controls, not a biomechanical simulation. Hands rotate at wrists; feet rotate at ankles. For example, `left-elbow` is the upper-arm bone, `left-wrist` the forearm bone, `left-hand` the hand bone; positional wrist selection is joint `left-wrist`.

`reset-pose` restores all stored `restRotation` values and clears that character's joint-position and bone-rotation locks. It preserves its world placement, proportions, appearance, and added limbs/heads, and creates one undoable change. Basic pose presets remain deferred.

The left/right clavicle and hip **connectors** (`modelPart` = `left-shoulder`, `right-shoulder`, `left-hip`, `right-hip`, including copies) have no local rotation on any axis. New characters initialize them with zero angles and zero bounds. Existing authored connector angles and historical bounds remain readable without changing the pose, but cannot be edited: `rotate-bone` returns the unchanged pose with `constrained: true` when a change is requested, IK keeps their local angles, and changed bounds or a pose replacement through operations fail with `SPATIAL_CONSTRAINT` (422). A direct draft save uses the shared invalid-record response (400). `reset-pose` explicitly restores their default angles; undo can restore the prior pose. These connectors still follow their parent in world space; a separate world-rotation pin also constrains parent motion. Pose arms through the upper-arm bones (`left/right-elbow`) and legs through the thigh bones (`left/right-knee`).

`add-character` accepts optional `height` (0.2–20) and `headRatio` (2–12). Use `set-proportions` to change these; fixed points may prevent rescaling. Head count is continuous, including 2.5, 3.5 and 2.7; the UI steps by 0.5 and accepts one decimal. The head reference length is computed directly as height / headRatio. Two- and three-head bodies have distinct matching-topology face/torso contour targets. Their vertex positions and rig dimensions blend continuously through the 2, 3, 4 and 7 references: low counts round the head, shorten the neck, soften anatomical relief and coordinate shoulders, torso, limbs, hands and feet independently. Head depth and torso depth also vary independently of front width to balance the side silhouette. Low-count rest-spine offsets follow longitudinal body scale independently of skin thickness, preventing an exaggerated forward waist bend; this rest-shape correction happens before authored bone rotations. The authored torso/leg split and bone rotations remain intact. Seven and above retain the original adult shape and elongated width curve. Stored joint offsets describe the anatomical base; use `inspect` world transforms for the resulting joint positions and bone lengths. The UI torso/leg slider uses 2-percentage-point steps; the API retains continuous values within its range. Both operations accept optional `bodyType` (`male` or `female`): new/unspecified bodies use the male source; omission in `set-proportions` preserves the current body. Switching updates the source mesh and anatomical dimensions, retaining the pose, locks and custom limbs; positional pin conflicts reject the batch. Use this operation rather than changing only the field on a standard humanoid. Both operations also accept optional `torsoRatio` (0.3–0.7), the torso share of rest height excluding the head; legs receive `1 - torsoRatio`. A smaller value makes longer legs. Omission on an existing character preserves its ratio; an omitted character field uses the model default. Changing this split keeps height, head size, arm/hand/foot lengths and bone rotations, redistributing torso and thigh/calf lengths. Use the same operation with the default ratio reported by a newly created standard character to restore proportions; `reset-pose` only resets pose and locks. Conflicting positional pins reject the edit; never unlock them silently. New characters default to `appearance: "quaternius"`; the optional `geometric` style uses the same rig with generated primitives. Use `put-character` preserving the other fields to change body color. The male and female Quaternius CC0 Superhero meshes are bundled locally with their own rig landmarks, retargeted and skinned identically in the editor and camera output. The editor-only joint/bone overlay is absent from color, structure and depth PNGs; the skeleton pass explicitly projects the rig without editor handles. Plain color is used; textures are not supported. Each hand includes the source five-finger skin weights and articulation. Cloned modules have overlapping attachment seams rather than a watertight mesh union.

Only version-2 scenes using `appearance: "quaternius"` are accepted. The retired character renderer and version-1 conversion have been removed; old appearance or version values fail validation.

```json
[
  { "type": "lock-joint", "characterId": "person", "jointId": "right-ankle", "position": true },
  { "type": "lock-bone", "characterId": "person", "boneId": "left-hand", "rotation": true },
  { "type": "move-joint", "characterId": "person", "jointId": "left-wrist", "position": [0.6, 1.3, 0.3] },
  { "type": "rotate-bone", "characterId": "person", "boneId": "left-elbow", "rotation": [-30, 0, -40] }
]
```

## Create four arms

For a new space, save this batch. `add-limb` copies a subtree, attaches its root using a local offset, copies the corresponding bone and mesh modules, assigns prefixed joint and bone IDs, and changes the character to `custom`. Existing joints and locks are preserved; new joints and bones start unlocked.

```json
[
  { "type": "add-character", "id": "creature", "name": "Four-arm creature", "height": 1.8, "headRatio": 7 },
  { "type": "add-limb", "characterId": "creature", "sourceJointId": "left-shoulder", "parentId": "chest", "idPrefix": "lower-left", "offset": [0.22, -0.2, 0] },
  { "type": "add-limb", "characterId": "creature", "sourceJointId": "right-shoulder", "parentId": "chest", "idPrefix": "lower-right", "offset": [-0.22, -0.2, 0] }
]
```

For a second head, copy the `neck` subtree and attach it to `chest`, for example `{"type":"add-limb","characterId":"creature","sourceJointId":"neck","parentId":"chest","idPrefix":"second","offset":[0.22,0.23,0]}`. The new head's bone is `second-head`. `modelPart` identifies the original mesh module and is preserved on copies. Reposition/rotate the two neck branches as needed to separate the silhouettes.

For a fully different morphology use `put-character` with the complete character shape returned by `spatial methods`. A custom rig requires unique joint IDs, exactly one root, an acyclic connected hierarchy, nonzero child offsets, and valid angle limits. Keep existing IDs stable when extending a character. Standard humanoid anatomy cannot be arbitrarily rewritten while retaining `kind: "humanoid"`.

## Cameras and objects

Scene-wide `lightingEnabled` defaults to `false`, including drafts where it is omitted. Use `[{ "type": "set-lighting", "enabled": true }]` through `spatial apply` to enable directional lighting and cast shadows, or `false` for evenly lit modeling. Both modes retain nearby contact shading and finger creases. The setting is saved and undoable, applies to every camera's ordinary PNG and composition reference, and does not change structure/depth passes or authored poses. It is not an ambient-light-only switch. `inspect` includes the saved field in `draft`.

`put-camera` creates or replaces a named camera. Preserve the other fields when changing one property. Perspective supports foreshortening; orthographic removes perspective scale changes. Position relative to target determines front/side, slight side, low angle, or high angle. Camera changes never mutate character poses.

```json
[
  { "type": "put-camera", "camera": {
    "id": "side", "name": "Side view", "position": [4, 1.1, 0], "target": [0, 0.9, 0],
    "projection": "perspective", "fov": 40, "span": 3.2,
    "width": 1200, "height": 900, "background": null
  } },
  { "type": "put-object", "object": {
    "id": "seat", "name": "Seat", "kind": "box", "position": [0, 0.25, -0.3],
    "rotation": [0, 0, 0], "size": [0.6, 0.5, 0.6], "color": "#b6a58c"
  } }
]
```

Objects support `box`, `sphere`, and `plane`. PNG dimensions are 128–2048 per axis; `background: null` preserves transparency. At least one camera must remain. Limits are 24 characters, 200 joints per character (including terminal points), 100 objects, 24 cameras, and 100 operations per batch.

## Composition camera references and PNG snapshots

The composition editor can insert several camera references from the same or different spaces. An image node's optional `cameraReference` stores `{ sessionId, cameraId, renderedRevision }`; its `assetId` points to the immutable PNG materialized in the **composition session's** image store. The open editor follows saved source revisions automatically while preserving node placement and width. An explicit camera aspect change adjusts node height to show the complete frame; ordinary pose edits retain both dimensions. A missing/deleted source displays a warning and retains its last PNG.

“Save as image node” retains the live reference and adds a separate image node without `cameraReference`. Both may share the immutable image asset at capture time; future live updates replace only the reference's asset. The snapshot survives source edits and deletion.

An Agent can construct the same nodes through the existing image upload and capture APIs: render the chosen source revision, upload that PNG to the target composition session, read the image-node schema from `capture schema`, add the node with its source pointer and returned asset ID, then save using the latest target revision. Never put a spatial-session asset ID into a composition node. For a static snapshot omit `cameraReference`. Session-based composition previews and reference exports embed the saved image assets, preserving the inspected document revision.

## Body dimensions shared by both sides

`add-character` and `set-proportions` accept four optional, actor-wide factors:

| Field | Range | Effect |
| --- | --- | --- |
| `neckLength` | 0.6–1.4 | Moves the head along the posed neck, retaining torso/shoulder and head dimensions. `height` is the base stature; no torso compensation keeps the actual top of the head fixed. |
| `palmSize` | 0.7–1.3 | Palm dimensions, finger-root spacing and finger thickness. Does not change digit bone lengths. |
| `fingerLength` | 0.6–1.4 | Axial length of all five digits, independently of palm size. |
| `footSize` | 0.7–1.4 | Foot width/length scale fully; thickness follows half the percentage change. Ankles rise/fall gently while knees/body stay in place and standing soles remain near their original level. This is a relative size, not a physical shoe number. |

`1` means the current head-count profile's default. Missing character fields behave as `1`; omission in `set-proportions` preserves the existing factor. UI sliders step by 2 percentage points; API values remain continuous inside the bounds. Both sides and cloned hands/feet share these fields, with no left/right overrides. Bone rotations, character placement and locks are retained. Conflicts with fixed world positions reject the entire batch, including complete-document saves. Later height/head/body-type edits and pose resets preserve these factors; use `1` to restore an individual dimension. Editor geometry, `inspect` transforms and PNG output use the same deformation rules.

```json
[{ "type": "set-proportions", "characterId": "person", "height": 1.8, "headRatio": 3,
   "neckLength": 1.2, "palmSize": 0.9, "fingerLength": 1.1, "footSize": 1.2 }]
```

## Hand and finger posing

Standard characters include `left-hand` and `right-hand` palm bones, rotating about their wrist. Every digit (`thumb`, `index`, `middle`, `ring`, `little`) has four joint IDs, for example `left-index-0` (fixed palm attachment/root), `left-index-1` (middle joint), `left-index-2` (distal joint) and `left-index-3` (tip). Incoming bone `-0` is a fixed attachment, not an editable phalanx. Bones `-1`, `-2`, `-3` rotate at their upstream joint. Thumb `-1` is its metacarpal; `-2` and `-3` are its two phalanges. Tips have no outgoing bone. Cloned hands retain these model roles under their cloned IDs; inspect IDs first.

Finger `rotate-bone.rotation` uses anatomical XYZ Euler degrees: X is flexion; Z is limited spread at the first segment; only the thumb base also allows Y opposition/twist. These axes are expressed through the source hand frame, unlike the body's parent-rest XYZ axes. The viewport gizmo uses the same frame. The thumb is the exception: distal bone `thumb-3` flexes on blue local Z (left −90–0°, right 0–90°), while proximal `thumb-2` retains X flexion and allows Z ±45°. The metacarpal `thumb-1` is unchanged. Other fingers’ middle/distal segments keep Y/Z fixed at zero. Saved default thumb bounds are corrected once (`thumbLimitsVersion: 2`) without moving poses or releasing pins; explicitly customized limits are retained. An existing distal X pose keeps enough X range to return to rest; new distal thumbs have X fixed at zero. Limits remain explicitly configurable through `set-bone-limits`. `move-joint` still accepts world coordinates; finger IK is restricted to that digit and reports a constraint rather than moving the wrist/arm to reach a distant target.

Use `pose-hand` for linked controls (all amounts 0–1). Omitted fields preserve their existing angles. `curl` accepts any subset of the five digit names; it drives each selected digit’s three flexion angles. Thumb distal curl writes mirrored Z and clears its old X curl; proximal manual Z is retained. `spread` opens the four non-thumb digits with mirrored left/right directions. `thumbOpposition` coordinates the thumb base’s Y/Z angles toward the palm. Manual per-bone rotation remains available afterward. Both position and world-rotation pins are hard constraints; a conflict rejects the batch without changing saved state.

```json
[
  { "type": "pose-hand", "characterId": "person", "handBoneId": "left-hand", "curl": { "thumb": 0.6, "middle": 0.8, "ring": 0.8, "little": 0.8 }, "thumbOpposition": 0.6 },
  { "type": "pose-hand", "characterId": "person", "handBoneId": "right-hand", "spread": 0.8 }
]
```

`reset-hand` takes `characterId` and `handBoneId`; it clears the selected palm/finger locks and restores their default rotations, retaining the arm, character placement, other hand and proportions. `reset-pose` still resets the whole actor, now including fingers. Both are undoable through the shared capture history. `add-limb` on a palm or upstream arm copies all its finger joints, bones and weights. Stored current-v2 Quaternius hands without finger chains are completed in memory when validated, retaining their body pose; a positional lock on the former hand-tip control transfers to the middle fingertip at the same world position. Saved versions are not rewritten. No retired v1/skeleton appearance is accepted; `geometric` uses the current v2 rig.
