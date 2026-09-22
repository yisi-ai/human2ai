# Model in a consumer project from style and spatial guidance

Human2AI supplies design intent. The consumer project owns final geometry,
materials, scene code and model assets. Use its existing renderer, modeling tools
and asset conventions; reading a style does not install or run a modeling engine.

## Read the style and spatial guidance

Resolve the integration and service using the parent Skill. The library is shared
by projects connected to the same local service, not automatically across machines.

For a supplied spatial session, run `session connect --session <id>`. Read
`style.current`, `capture.latest`, and the returned commands. Retain its existing
style unless the user requests another. When a style is requested but none is
bound, inspect suitable entries with `style list --category spatial` and
`style get --style <id>`, choose according to the task, and bind through the
connection's command using its session revision. Categories are discovery filters,
not restrictions on binding. Reconnect after binding or a revision conflict.

Use the full description and inspect the reference images; the name and
`promptSummary` alone are insufficient modeling instructions. A standalone style
can also guide modeling without creating a Human2AI session.

For a saved spatial guide, use one captured revision for inspection and all views:

```text
<runner> spatial inspect --session <id> --revision <n> --output .human2ai-data/output/spatial-guide.json
<runner> spatial render --session <id> --revision <n> --camera <camera-id> --output .human2ai-data/output/spatial-guide.png
```

Read [spatial.md](spatial.md) for coordinates, character transforms, camera
projection and optional depth, structure or observation-box references. Inspect
the rendered image as well as the structured data. Select cameras from the actual
draft and the user's request. An unsaved space has no saved revision to inspect;
do not invent guidance or silently create a guide when the task is standalone
modeling. Export additional views only when they clarify occlusion or geometry.

## Save a generated style example

When asked for a 3D style preview, generate a fixed model that demonstrates the
style's forms, joints, palette and materials. Export a self-contained GLB 2.0 to
ignored `.human2ai-data/output/`, with embedded geometry and textures, no external
decoder dependencies, and a file size of at most 10 MB. Human2AI stores the model
and provides a read-only orbit/zoom preview; it does not execute generator code
or generate geometry from the description when a user opens the style.

```text
<runner> style set-model --style <id> --input .human2ai-data/output/style-example.glb --expected-revision <n>
<runner> style remove-model --style <id> --expected-revision <n>
```

Each style has at most one model; setting another replaces it. Read the current
revision with `style list` before writing. `style get` returns its optional
`previewModel.url` alongside the images and specification. Review the saved model
in the style detail view. Revisit the example when the specification changes;
it is reference evidence, not a substitute for the user's spatial layout.

## Interpret the inputs

- The user's requested content, functions, dimensions, pose constraints and
  delivery requirements govern the result.
- The spatial draft guides relative positions, scale relationships, pose,
  occlusion and camera framing. Preserve explicitly required placements and
  viewpoints. Treat other blockout details as approximate guidance that can be
  refined for the actual objects.
- Read each character, object, camera and observation box's optional `note`
  alongside its stable ID, name and geometry. These user instructions explain
  what placeholders represent and which relationships or views must be retained;
  they are available in `inspect` rather than drawn into the PNG. Preserve them
  if the task also requires editing the Human2AI guide.
- The style guides shape language, proportion tendencies, surface detail,
  materials, palette and lighting. Resolve these within the user's spatial
  constraints rather than moving the scene to fit a style reference image.
- Placeholder boxes, pose-guide colors, joint markings and geometric mannequins
  are authoring aids unless the user explicitly asks for those appearances.
  For example, a house placeholder can become a detailed house while retaining
  its intended footprint and relationship to neighboring objects.

Account for the consumer project's units, coordinate system and camera conventions
when translating guidance. Do not import Human2AI's database or private runtime
modules into the consumer application. Human2AI exports scene data and reference
PNGs; it does not currently expose a GLB export command.

## Build and review

Implement with the consumer project's available modeling workflow and save the
deliverables in its normal source/asset locations. Keep temporary references and
previews in ignored `.human2ai-data/output/`. Ask for a missing tool choice only
when it materially blocks the requested deliverable.

Render the consumer result from the requested viewpoint. Compare layout, relative
scale, silhouettes, pose and occlusion with the spatial guide, and compare forms,
materials, palette and lighting with the style. Use extra viewpoints to inspect
the completed geometry where needed. Preserve user-authored work while iterating.
State any unsupported requirement rather than reporting an unverified result.

Report the produced files and which spatial/style requirements were verified.
Include the source session/capture and style revisions when available from the
connection. Do not mark the Human2AI guide as processed or rewrite its draft just
to record that modeling finished elsewhere. Re-read current guidance before a
subsequent task instead of assuming an earlier binding is still current.

## Author a reusable 3D style

Save it with `style create --category spatial` using the parent Skill's commands.
Keep the full specification in `description`, plus a concise summary and optional
reference images. Use this outline as relevant to the actual style:

- Forms: silhouettes, curvature, simplification and edge treatment.
- Proportions: characteristic exaggeration and consistency across object families.
- Surfaces: materials, reflectivity, roughness and visible texture treatment.
- Palette: dominant, supporting and accent colors.
- Lighting and presentation: shadow softness, contrast and preferred camera treatment.
- Boundaries: defining traits to retain and treatments that would contradict them.

Reference images can show an overview, details and useful alternate angles.
Keep project-specific dimensions, polygon budgets and output formats with the
project's task unless they are essential to this reusable style. A style entry
stores a specification and images; mesh files remain consumer-project assets.
