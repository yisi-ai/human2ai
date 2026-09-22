#!/usr/bin/env node

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  CliIntegrationError,
  executeIntegrationCommand,
  integrationStartDirectory,
  integrationUsage,
  readIntegrationManifestSync,
} from "./integration.ts";
import { isDevelopmentSource, resolveRuntimeDefaults } from "../runtime-defaults.ts";
import {
  RefinementConstraintError,
  applyRefinementPlan,
  inspectComposition,
  refinementMethods,
  refinementPlanSchema,
  renderCompositionReferenceSvg,
  renderCompositionSvg,
  validateDraft,
  type CompositionDraft,
  type CompositionRefinementResult,
} from "../domain/composition/index.ts";
import {
  SESSION_TYPES,
  sessionTypeDefinition,
  type Session,
  type SessionType,
  type StyleProcessing,
} from "../domain/session/index.ts";
import type { StyleEntry } from "../domain/style/index.ts";
import {
  validateUiSketchDraft,
  standardizeUiSketchDraft,
  uiSketchStateTabs,
  uiSketchDraftForStage,
  renderUiSketchSvg,
  type UiSketchDraft,
} from "../domain/ui-sketch/index.ts";

import { validateSpatialDraft, jointWorldTransforms, boneWorldTransforms, angles, type SpatialDraft } from "../domain/spatial/index.ts";
import spatialOperationsSchema from "../../schemas/spatial-operations.schema.json" with { type: "json" };
import spatialSchema from "../../schemas/spatial-draft.schema.json" with { type: "json" };
import { SPATIAL_BOX_FACES, SPATIAL_RENDER_PASSES } from "../domain/spatial/types.ts";
import { parseSpatialBoxViews } from "../domain/spatial/camera-box-sheet.ts";
import en from "../../locales/en/common.json" with { type: "json" };

interface CommandOptions {
  agent?: string;
  asset?: string;
  category?: string;
  camera?: string;
  box?: string;
  view?: string;
  views?: string;
  pass?: string;
  changeRevision?: string;
  check?: boolean;
  description?: string;
  draft?: string;
  expectedRevision?: string;
  input?: string;
  kind?: string;
  mode?: string;
  name?: string;
  output?: string;
  plan?: string;
  preview?: string;
  project?: string;
  creator?: string;
  reference?: string;
  revision?: string;
  root?: string;
  run?: string;
  session?: string;
  state?: string;
  style?: string;
  styleRevision?: string;
  sessionRevision?: string;
  summary?: string;
  title?: string;
  type?: string;
  unassigned?: boolean;
}

export interface CliDependencies {
  cwd?: string;
  fetch?: typeof fetch;
  integrationSourceRoot?: string;
  openUrl?: (url: string) => Promise<void>;
  serviceUrl?: string;
  webUrl?: string;
}

interface CliGlobalOptions {
  apiUrl?: string;
  webUrl?: string;
}

interface DraftVersionPayload {
  id: string;
  sessionId: string;
  revision: number;
  fingerprint: string;
  draft: CompositionDraft;
  createdAt: string;
}

interface RefinementRunPayload {
  id: string;
  sessionId: string;
  sourceDraftVersionId: string;
  sourceDraftRevision: number;
  sourceFingerprint: string;
  plan: unknown;
  result: CompositionRefinementResult;
  createdAt: string;
}

type CaptureDocument = CompositionDraft | UiSketchDraft | SpatialDraft;

interface CaptureDescriptor {
  sessionId: string;
  sessionType: SessionType;
  captureKind: "composition-draft" | "ui-layout-draft" | "spatial-draft";
  draftsPath: string;
  validateDocument: (input: unknown) => CaptureDocument;
}

interface CaptureVersionPayload {
  id: string;
  sessionId: string;
  revision: number;
  fingerprint: string;
  document: CaptureDocument;
  createdAt: string;
  styleProcessing?: StyleProcessing;
}

export class CliServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CliServiceError";
  }
}

export async function executeCli(
  args: string[],
  dependencies: CliDependencies = {},
): Promise<unknown> {
  const invocation = parseGlobalOptions(args);
  const effectiveDependencies = {
    ...dependencies,
    ...(invocation.options.apiUrl === undefined
      ? {}
      : { serviceUrl: invocation.options.apiUrl }),
    ...(invocation.options.webUrl === undefined
      ? {}
      : { webUrl: invocation.options.webUrl }),
  };
  const scope = invocation.commandArgs[0];
  const command = invocation.commandArgs[1];
  const options = parseOptions(invocation.commandArgs.slice(2));

  if (scope === "service") {
    return executeServiceCommand(command, options, effectiveDependencies);
  }

  if (scope === "integration") {
    if (command === "install") {
      assertOnlyOptions(options, ["agent", "root", "mode"], "integration install");
    } else if (command === "sync") {
      assertOnlyOptions(options, ["root", "check"], "integration sync");
    } else if (command === "doctor") {
      assertOnlyOptions(options, ["root"], "integration doctor");
    } else {
      throw new Error(integrationUsage());
    }
    const startDirectory = options.root
      ?? effectiveDependencies.cwd
      ?? integrationStartDirectory();
    const integrationDependencies = {
      ...effectiveDependencies,
      cwd: startDirectory,
    };
    const development = isDevelopmentSource(effectiveDependencies.integrationSourceRoot);
    const defaults = resolveRuntimeDefaults(effectiveDependencies.integrationSourceRoot);
    return executeIntegrationCommand(command, options, {
      apiUrl: configuredServiceUrl(
        integrationDependencies,
        defaults.apiUrl,
      ).origin,
      sourceRoot: effectiveDependencies.integrationSourceRoot,
      startDirectory,
      webUrl: configuredWebUrl(
        integrationDependencies,
        development ? defaults.webUrl : undefined,
      ).origin,
    });
  }

  if (scope === "project") {
    return executeProjectCommand(command, options, effectiveDependencies);
  }
  if (scope === "session") {
    return executeSessionCommand(command, options, effectiveDependencies);
  }
  if (scope === "capture") {
    return executeCaptureCommand(command, options, effectiveDependencies);
  }
  if (scope === "style") {
    return executeStyleCommand(command, options, effectiveDependencies);
  }
  if (scope === "image") {
    return executeImageCommand(command, options, effectiveDependencies);
  }
  if (scope === "spatial") {
    if (command === "methods") {
      assertOnlyOptions(options, [], "spatial methods");
      return { kind: "spatial-methods", schema: spatialSchema, operationsSchema: spatialOperationsSchema, renderPasses: SPATIAL_RENDER_PASSES, cameraBoxViews: ["sheet", ...SPATIAL_BOX_FACES], cameraBoxViewSelection: { option: "--views", separator: ",", values: SPATIAL_BOX_FACES, minItems: 1, maxItems: SPATIAL_BOX_FACES.length, uniqueItems: true, ordered: true, requires: "--box", exclusiveWith: "--view" }, cameraBoxGuidance: en.spatial.cameraBoxGenerationGuidance, operations: ["set-lighting", "add-character", "put-character", "add-limb", "set-proportions", "move-joint", "rotate-bone", "lock-joint", "lock-bone", "set-bone-limits", "reset-pose", "pose-hand", "reset-hand", "put-object", "put-camera", "put-camera-box", "fit-camera-box", "remove"], reference: "skills/human2ai/references/spatial.md" };
    }
    const sessionId = requireOption(options, "session");
    if (command === "inspect") {
      assertOnlyOptions(options, ["session", "revision", "output"], "spatial inspect");
      const revision = requireInteger(options, "revision", 1);
      const version = requireRecord(await requestService(effectiveDependencies, `/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/drafts/${revision}`), "spatial draft");
      const draft = validateSpatialDraft(version.draft);
      const result = { sessionId, revision, draft, characters: draft.characters.map(character => ({ id: character.id, bones: Object.entries(boneWorldTransforms(character)).map(([id,world])=>({id,pivotPosition:world.position.toArray(),worldRotation:angles(world.rotation)})), joints: Object.entries(jointWorldTransforms(character)).map(([id, world]) => ({ id, worldPosition: world.position.toArray(), worldRotation: angles(world.rotation) })) })) };
      if (options.output) await writeJson(path.resolve(options.output), result);
      return result;
    }
    if (command === "apply") {
      assertOnlyOptions(options, ["session", "revision", "input", "output"], "spatial apply");
      const result = await requestService(effectiveDependencies, `/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/operations`, { method: "POST", body: { expectedLatestRevision: requireInteger(options, "revision", 0), operations: await readJson(path.resolve(requireOption(options, "input"))) } });
      if (options.output) await writeJson(path.resolve(options.output), result);
      return result;
    }
    if (command === "render") {
      assertOnlyOptions(options, ["session", "revision", "camera", "box", "view", "views", "pass", "output"], "spatial render");
      const cameraId = options.camera, boxId = options.box;
      if (Boolean(cameraId) === Boolean(boxId)) throw new Error(en.spatial.cameraBoxTargetError);
      const view = options.view ?? "sheet";
      if ((options.view !== undefined || options.views !== undefined) && !boxId) throw new Error(en.spatial.cameraBoxViewTargetError);
      if (options.view !== undefined && options.views !== undefined) throw new Error(en.spatial.cameraBoxViewConflict);
      const views = options.views === undefined ? undefined : parseSpatialBoxViews(options.views);
      if (views === null) throw new Error(en.spatial.cameraBoxViewsError);
      if (view !== "sheet" && !SPATIAL_BOX_FACES.some(face => face === view)) throw new Error(en.spatial.cameraBoxViewError);
      const revision = requireInteger(options, "revision", 1);
      const pass = options.pass ?? "color";
      if (!SPATIAL_RENDER_PASSES.some(value => value === pass)) throw new Error(en.spatial.renderPassError.replace("{{passes}}", SPATIAL_RENDER_PASSES.join(", ")));
      const viewQuery = views ? `views=${encodeURIComponent(views.join(","))}` : `view=${view}`;
      const target = boxId ? `camera-boxes/${encodeURIComponent(boxId)}.png?${viewQuery}&` : `cameras/${encodeURIComponent(cameraId!)}.png?`;
      const png = await requestService(effectiveDependencies, `/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/${target}revision=${revision}&pass=${pass}`, { png: true }) as Buffer;
      const outputPath = path.resolve(requireOption(options, "output"));
      await writeFile(outputPath, png);
      return { sessionId, ...(boxId ? { boxId, ...(views ? { views } : { view }) } : { cameraId }), revision, pass, outputPath };
    }
    throw new Error("Use spatial methods, spatial inspect, spatial apply, or spatial render.");
  }
  if (scope === "ui-layout" && command === "render") {
    return renderUiLayoutPreview(options, effectiveDependencies);
  }
  if (scope === "ui-layout" && command === "standardize") {
    assertOnlyOptions(options, ["input", "output", "plan"], "ui-layout standardize");
    const inputPath = path.resolve(requireOption(options, "input"));
    const outputPath = path.resolve(requireOption(options, "output"));
    if (inputPath === outputPath) throw new Error("Standardization output must differ from the source document.");
    const result = standardizeUiSketchDraft(
      await readJson(inputPath),
      options.plan ? await readJson(path.resolve(options.plan)) : undefined,
    );
    await writeJson(outputPath, result.draft);
    const { draft: _draft, ...report } = result;
    return { ...report, outputPath };
  }
  if (scope !== "composition") throw new Error(usage());

  if (command === "methods") {
    assertOnlyOptions(options, [], "methods");
    return {
      version: 1,
      kind: "composition-refinement-methods",
      decisionOwner: "agent",
      methods: refinementMethods(),
      planSchema: refinementPlanSchema(),
    };
  }

  if (command === "save") {
    assertOnlyOptions(options, ["session", "draft", "expectedRevision"], "save");
    const sessionId = requireOption(options, "session");
    const draftPath = path.resolve(requireOption(options, "draft"));
    const draft = validateDraft(await readJson(draftPath));
    const expectedLatestRevision = requireInteger(options, "expectedRevision", 0);
    return parseDraftVersion(
      await requestService(effectiveDependencies, compositionDraftsPath(sessionId), {
        method: "POST",
        body: { expectedLatestRevision, draft },
      }),
    );
  }

  if (command === "drafts") {
    assertOnlyOptions(options, ["session"], "drafts");
    const sessionId = requireOption(options, "session");
    return requestService(effectiveDependencies, compositionDraftsPath(sessionId));
  }

  if (command === "inspect") {
    return options.session
      ? inspectSessionDraft(options, effectiveDependencies)
      : inspectLocalDraft(options);
  }

  if (command === "apply") {
    return options.session
      ? applySessionRefinement(options, effectiveDependencies)
      : applyLocalRefinement(options);
  }

  if (command === "refinements") {
    assertOnlyOptions(options, ["session"], "refinements");
    const sessionId = requireOption(options, "session");
    return requestService(effectiveDependencies, compositionRefinementsPath(sessionId));
  }

  if (command === "refinement") {
    assertOnlyOptions(
      options,
      ["session", "run", "output", "preview"],
      "refinement",
    );
    const sessionId = requireOption(options, "session");
    const runId = requireOption(options, "run");
    const run = parseRefinementRun(
      await requestService(
        effectiveDependencies,
        `${compositionRefinementsPath(sessionId)}/${encodeURIComponent(runId)}`,
      ),
    );
    return writeSessionRefinementArtifacts(run, options, effectiveDependencies);
  }

  if (command === "reference") {
    return writeSessionReference(options, effectiveDependencies);
  }

  throw new Error(usage());
}

async function executeStyleCommand(
  command: string | undefined,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  if (command === "list") {
    assertOnlyOptions(options, ["category", "creator"], "style list");
    if (options.category) requireStyleCategory(options);
    if (options.creator && options.creator !== "user" && options.creator !== "agent") {
      throw new Error("--creator must be user or agent.");
    }
    const payload = requireRecord(
      await requestService(dependencies, "/api/v1/styles"),
      "style list",
    );
    if (!Array.isArray(payload.styles)) {
      throw invalidServiceResponse("style list styles is not an array");
    }
    return {
      styles: payload.styles.filter((style) => (
        isRecord(style)
        && (!options.category || style.category === options.category)
        && (!options.creator || style.creatorType === options.creator)
      )),
    };
  }

  if (command === "get") {
    assertOnlyOptions(options, ["style"], "style get");
    const styleId = requireOption(options, "style");
    const payload = requireRecord(
      await requestService(
        dependencies,
        `/api/v1/agent/styles/${encodeURIComponent(styleId)}/context`,
      ),
      "style context",
    );
    if (typeof payload.description !== "string" || !Array.isArray(payload.referenceImages)) {
      throw invalidServiceResponse("style context is invalid");
    }
    return {
      referenceImages: payload.referenceImages.map((reference) => {
        const value = requireRecord(reference, "style reference");
        if (typeof value.url !== "string") {
          throw invalidServiceResponse("style reference URL is invalid");
        }
        return { url: new URL(value.url, configuredServiceUrl(dependencies)).toString() };
      }),
      ...(payload.previewModel === undefined ? {} : {
        previewModel: { url: new URL(styleModelUrl(payload.previewModel), configuredServiceUrl(dependencies)).toString() },
      }),
      description: payload.description,
    };
  }

  if (command === "create") {
    assertOnlyOptions(options, ["name", "category", "description", "summary"], "style create");
    return requestService(dependencies, "/api/v1/agent/styles", {
      method: "POST",
      body: {
        name: requireOption(options, "name"),
        category: requireStyleCategory(options),
        ...(options.summary === undefined ? {} : { promptSummary: options.summary }),
        description: requireOption(options, "description"),
      },
    });
  }

  if (command === "update") {
    assertOnlyOptions(
      options,
      ["style", "expectedRevision", "name", "category", "description", "summary"],
      "style update",
    );
    if (options.name === undefined && options.category === undefined && options.description === undefined && options.summary === undefined) {
      throw new Error("style update requires --name, --category, --description, or --summary.");
    }
    const styleId = requireOption(options, "style");
    return requestService(
      dependencies,
      `/api/v1/styles/${encodeURIComponent(styleId)}`,
      {
        method: "PATCH",
        body: {
          expectedRevision: requireInteger(options, "expectedRevision", 1),
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(options.summary === undefined ? {} : { promptSummary: options.summary }),
          ...(options.category === undefined
            ? {}
            : { category: requireStyleCategory(options) }),
          ...(options.description === undefined
            ? {}
            : { description: options.description }),
        },
      },
    );
  }

  if (command === "set-model") {
    assertOnlyOptions(options, ["style", "input", "expectedRevision"], "style set-model");
    const styleId = requireOption(options, "style");
    const filename = path.resolve(requireOption(options, "input"));
    return requestImageService(dependencies,
      `/api/v1/styles/${encodeURIComponent(styleId)}/model?filename=${encodeURIComponent(path.basename(filename))}&expectedRevision=${requireInteger(options, "expectedRevision", 1)}`,
      await readFile(filename));
  }

  if (command === "remove-model") {
    assertOnlyOptions(options, ["style", "expectedRevision"], "style remove-model");
    return requestService(dependencies, `/api/v1/styles/${encodeURIComponent(requireOption(options, "style"))}/model`, {
      method: "DELETE", body: { expectedRevision: requireInteger(options, "expectedRevision", 1) },
    });
  }

  if (command === "add-reference") {
    assertOnlyOptions(
      options,
      ["style", "input", "expectedRevision"],
      "style add-reference",
    );
    const styleId = requireOption(options, "style");
    const filename = path.resolve(requireOption(options, "input"));
    return requestImageService(
      dependencies,
      `/api/v1/styles/${encodeURIComponent(styleId)}/references?filename=${encodeURIComponent(path.basename(filename))}&expectedRevision=${requireInteger(options, "expectedRevision", 1)}`,
      await readFile(filename),
    );
  }

  if (command === "remove-reference") {
    assertOnlyOptions(
      options,
      ["style", "reference", "expectedRevision"],
      "style remove-reference",
    );
    const styleId = requireOption(options, "style");
    const referenceId = requireOption(options, "reference");
    return requestService(
      dependencies,
      `/api/v1/styles/${encodeURIComponent(styleId)}/references/${encodeURIComponent(referenceId)}`,
      {
        method: "DELETE",
        body: { expectedRevision: requireInteger(options, "expectedRevision", 1) },
      },
    );
  }

  if (command === "delete") {
    assertOnlyOptions(options, ["style", "expectedRevision"], "style delete");
    const styleId = requireOption(options, "style");
    await requestService(
      dependencies,
      `/api/v1/styles/${encodeURIComponent(styleId)}`,
      {
        method: "DELETE",
        body: { expectedRevision: requireInteger(options, "expectedRevision", 1) },
      },
    );
    return { deleted: true, styleId };
  }

  throw new Error(styleUsage());
}

function requireStyleCategory(options: CommandOptions): "visual" | "ui" | "spatial" {
  const value = requireOption(options, "category");
  if (value !== "visual" && value !== "ui" && value !== "spatial") {
    throw new Error("--category must be visual, ui or spatial.");
  }
  return value;
}

async function executeImageCommand(
  command: string | undefined,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  if (command === "upload") {
    assertOnlyOptions(options, ["session", "input"], "image upload");
    const sessionId = requireOption(options, "session");
    const filename = path.resolve(requireOption(options, "input"));
    return requestImageService(
      dependencies,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/assets?filename=${encodeURIComponent(path.basename(filename))}`,
      await readFile(filename),
    );
  }
  if (command === "source") {
    assertOnlyOptions(options, ["session", "asset", "output"], "image source");
    const sessionId = requireOption(options, "session");
    const assetId = requireOption(options, "asset");
    const source = await requestService(
      dependencies,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/assets/${encodeURIComponent(assetId)}/content`,
      { svgSource: true },
    ) as string;
    if (options.output) {
      const output = path.resolve(options.output);
      await writeFile(output, source, "utf8");
      return { sessionId, assetId, output };
    }
    return { sessionId, assetId, source };
  }
  throw new Error(imageUsage());
}

async function executeProjectCommand(
  command: string | undefined,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  if (command === "list") {
    assertOnlyOptions(options, [], "project list");
    return requestService(dependencies, "/api/v1/projects");
  }

  if (command === "create") {
    assertOnlyOptions(options, ["name", "description"], "project create");
    return requestService(dependencies, "/api/v1/projects", {
      method: "POST",
      body: {
        name: requireOption(options, "name"),
        ...(options.description === undefined
          ? {}
          : { description: options.description }),
      },
    });
  }

  if (command === "get") {
    assertOnlyOptions(options, ["project"], "project get");
    return requestService(
      dependencies,
      `/api/v1/projects/${encodeURIComponent(requireOption(options, "project"))}`,
    );
  }

  if (command === "update") {
    assertOnlyOptions(
      options,
      ["project", "expectedRevision", "name", "description"],
      "project update",
    );
    if (options.name === undefined && options.description === undefined) {
      throw new Error("project update requires --name or --description.");
    }
    const projectId = requireOption(options, "project");
    return requestService(
      dependencies,
      `/api/v1/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PATCH",
        body: {
          expectedRevision: requireInteger(options, "expectedRevision", 1),
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(options.description === undefined
            ? {}
            : { description: options.description }),
        },
      },
    );
  }

  throw new Error(projectUsage());
}

async function executeSessionCommand(
  command: string | undefined,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  if (command === "style") {
    assertOnlyOptions(options, ["session"], "session style");
    return requestService(dependencies, `/api/v1/sessions/${encodeURIComponent(requireOption(options, "session"))}/style`);
  }
  if (command === "bind-style" || command === "unbind-style") {
    assertOnlyOptions(options,
      command === "bind-style" ? ["session", "style", "expectedRevision"] : ["session", "expectedRevision"],
      `session ${command}`);
    return requestService(dependencies, `/api/v1/sessions/${encodeURIComponent(requireOption(options, "session"))}/style`, {
      method: "PATCH",
      body: {
        styleId: command === "bind-style" ? requireOption(options, "style") : null,
        expectedRevision: requireInteger(options, "expectedRevision", 1),
      },
    });
  }
  if (command === "connect") {
    assertOnlyOptions(options, ["session"], "session connect");
    return connectSession(requireOption(options, "session"), dependencies);
  }

  if (command === "open") {
    assertOnlyOptions(options, ["session"], "session open");
    const connection = await connectSession(
      requireOption(options, "session"),
      dependencies,
    );
    await (dependencies.openUrl ?? openExternalUrl)(connection.ui.editUrl);
    return {
      version: 1,
      kind: "session-opened",
      sessionId: connection.session.id,
      url: connection.ui.editUrl,
      opened: true,
    };
  }

  if (command === "list") {
    assertOnlyOptions(options, ["project", "unassigned"], "session list");
    assertExclusiveProjectTarget(options, true);
    const pathname = options.unassigned
      ? "/api/v1/sessions/unassigned"
      : options.project
        ? `/api/v1/projects/${encodeURIComponent(options.project)}/sessions`
        : "/api/v1/sessions";
    return requestService(dependencies, pathname);
  }

  if (command === "create") {
    assertOnlyOptions(options, ["type", "title", "project"], "session create");
    return requestService(dependencies, "/api/v1/sessions", {
      method: "POST",
      body: {
        sessionType: requireOption(options, "type"),
        title: requireOption(options, "title"),
        ...(options.project === undefined ? {} : { projectId: options.project }),
      },
    });
  }

  if (command === "get") {
    assertOnlyOptions(options, ["session"], "session get");
    return requestService(
      dependencies,
      `/api/v1/sessions/${encodeURIComponent(requireOption(options, "session"))}`,
    );
  }

  if (command === "move") {
    assertOnlyOptions(
      options,
      ["session", "project", "unassigned", "expectedRevision"],
      "session move",
    );
    assertExclusiveProjectTarget(options, false);
    const sessionId = requireOption(options, "session");
    return requestService(
      dependencies,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/project`,
      {
        method: "PATCH",
        body: {
          projectId: options.unassigned ? null : options.project,
          expectedRevision: requireInteger(options, "expectedRevision", 1),
        },
      },
    );
  }

  throw new Error(sessionUsage());
}

async function executeServiceCommand(
  command: string | undefined,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  if (command !== "status") throw new Error(serviceUsage());
  assertOnlyOptions(options, [], "service status");
  const payload = requireRecord(
    await requestService(dependencies, "/api/v1/health"),
    "service status",
  );
  if (
    payload.service !== "human2ai"
    || payload.status !== "ok"
    || !Array.isArray(payload.capabilities)
    || payload.capabilities.some((capability) => typeof capability !== "string")
  ) {
    throw invalidServiceResponse("service health metadata is invalid");
  }
  return {
    version: 1,
    kind: "service-status",
    status: "ready",
    apiUrl: configuredServiceUrl(dependencies).origin,
    webUrl: configuredWebUrl(dependencies).origin,
    capabilities: payload.capabilities,
  };
}

async function connectSession(
  sessionId: string,
  dependencies: CliDependencies,
): Promise<{
  version: 1;
  kind: "session-connection";
  service: { apiUrl: string; webUrl: string };
  cli: { executable: "human2ai" };
  session: Session;
  ui: { editUrl: string };
  capture: Record<string, unknown>;
  operations: ReadonlyArray<Record<string, unknown>>;
  style: Record<string, unknown>;
  images: Record<string, unknown>;
}> {
  let session = parseSession(
    await requestService(
      dependencies,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    ),
    sessionId,
  );
  let currentStyle: StyleEntry | null = null;
  if (session.styleId) {
    const state = requireRecord(await requestService(dependencies,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/style`), "session style");
    session = parseSession(state.session, sessionId);
    if (state.style !== null) {
      const value = requireRecord(state.style, "session style entry");
      if (value.id !== session.styleId || !Number.isInteger(value.revision)
        || typeof value.description !== "string" || !Array.isArray(value.referenceImages)) {
        throw invalidServiceResponse("session style is invalid");
      }
      currentStyle = value as unknown as StyleEntry;
    }
  }
  const descriptor = captureDescriptor(session);
  const draftsPayload = requireRecord(
    await requestService(dependencies, descriptor.draftsPath),
    "capture list",
  );
  if (!Array.isArray(draftsPayload.draftVersions)) {
    throw invalidServiceResponse("capture list draftVersions is not an array");
  }
  const versions = draftsPayload.draftVersions.map((version) =>
    parseCaptureVersion(version, descriptor));
  const latest = versions.at(-1) ?? null;
  const definition = sessionTypeDefinition(session.sessionType);
  const webUrl = configuredWebUrl(dependencies);
  const editUrl = new URL(definition.uiPath, webUrl);
  editUrl.searchParams.set("session", session.id);
  const commandPrefix = [
    "--api-url",
    configuredServiceUrl(dependencies).origin,
    "--web-url",
    webUrl.origin,
  ];
  const sessionCommand = (command: string, extra: string[] = []) => [
    ...commandPrefix,
    "session",
    command,
    "--session",
    session.id,
    ...extra,
  ];
  const captureCommand = (command: string, extra: string[] = []) => [
    ...commandPrefix,
    "capture",
    command,
    "--session",
    session.id,
    ...extra,
  ];
  return {
    version: 1,
    kind: "session-connection",
    service: {
      apiUrl: configuredServiceUrl(dependencies).origin,
      webUrl: webUrl.origin,
    },
    cli: { executable: "human2ai" },
    session,
    images: {
      mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
      commands: {
        upload: [...commandPrefix, "image", "upload", "--session", session.id, "--input", "<image-file>"],
        source: [...commandPrefix, "image", "source", "--session", session.id, "--asset", "<asset-id>"],
      },
    },
    style: {
      current: currentStyle ? {
        id: currentStyle.id, name: currentStyle.name, revision: currentStyle.revision,
        promptSummary: currentStyle.promptSummary, description: currentStyle.description,
        ...(currentStyle.previewModel ? { previewModel: {
          url: new URL(`/api/v1/styles/${encodeURIComponent(currentStyle.id)}/models/${encodeURIComponent(currentStyle.previewModel.id)}/content`, configuredServiceUrl(dependencies)).toString(),
        } } : {}),
        referenceImages: currentStyle.referenceImages.map((reference) => ({
          url: new URL(`/api/v1/styles/${encodeURIComponent(currentStyle!.id)}/references/${encodeURIComponent(reference.id)}/content`, configuredServiceUrl(dependencies)).toString(),
        })),
      } : null,
      commands: {
        get: sessionCommand("style"),
        list: [...commandPrefix, "style", "list"],
        bind: sessionCommand("bind-style", ["--style", "<style-id>", "--expected-revision", String(session.revision)]),
        unbind: sessionCommand("unbind-style", ["--expected-revision", String(session.revision)]),
        ...(currentStyle ? {
          save: captureCommand("save", ["--kind", descriptor.captureKind, "--input", "<document.json>",
            "--expected-revision", String(latest?.revision ?? 0), "--style", currentStyle.id,
            "--style-revision", String(currentStyle.revision), "--session-revision", String(session.revision)]),
        } : {}),
      },
    },
    ui: { editUrl: editUrl.toString() },
    capture: {
      kind: descriptor.captureKind,
      latest: latest === null
        ? null
        : {
            id: latest.id,
            revision: latest.revision,
            fingerprint: latest.fingerprint,
            createdAt: latest.createdAt,
            ...(latest.styleProcessing ? { styleProcessing: latest.styleProcessing } : {}),
          },
      commands: {
        list: captureCommand("list"),
        save: captureCommand("save", [
          "--kind",
          descriptor.captureKind,
          "--input",
          "<document.json>",
          "--expected-revision",
          String(latest?.revision ?? 0),
        ]),
        ...(latest === null
          ? {}
          : {
              get: captureCommand("get", [
                "--kind",
                descriptor.captureKind,
                "--revision",
                String(latest.revision),
              ]),
              ...(latest.revision <= 1
                ? {}
                : {
                    undo: captureCommand("undo", [
                      "--kind",
                      descriptor.captureKind,
                      "--change-revision",
                      String(latest.revision),
                      "--expected-revision",
                      String(latest.revision),
                    ]),
                  }),
            }),
      },
    },
    operations: [
      {
        id: "session.connect@1",
        mode: "read",
        command: sessionCommand("connect"),
      },
      {
        id: "session.open@1",
        mode: "read",
        command: sessionCommand("open"),
      },
      ...definition.operations.map((operation) => ({
        ...operation,
        command: [
          ...commandPrefix,
          ...operation.command,
          ...(operation.sessionScoped ? ["--session", session.id] : []),
        ],
      })),
    ],
  };
}

async function executeCaptureCommand(
  command: string | undefined,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  if (command === "list") {
    assertOnlyOptions(options, ["session"], "capture list");
    const descriptor = await resolveCaptureDescriptor(
      requireOption(options, "session"),
      dependencies,
    );
    const payload = requireRecord(
      await requestService(dependencies, descriptor.draftsPath),
      "capture list",
    );
    if (!Array.isArray(payload.draftVersions)) {
      throw invalidServiceResponse("capture list draftVersions is not an array");
    }
    const versions = payload.draftVersions.map((version) =>
      parseCaptureVersion(version, descriptor));
    return {
      version: 1,
      kind: "capture-list",
      sessionId: descriptor.sessionId,
      sessionType: descriptor.sessionType,
      captures: [{
        captureKind: descriptor.captureKind,
        versions: versions.map(({ id, revision, fingerprint, createdAt, styleProcessing }) => ({
          id,
          revision,
          fingerprint,
          createdAt,
          ...(styleProcessing ? { styleProcessing } : {}),
        })),
      }],
    };
  }

  if (command === "get") {
    assertOnlyOptions(options, ["session", "kind", "revision"], "capture get");
    const descriptor = await resolveCaptureDescriptor(
      requireOption(options, "session"),
      dependencies,
    );
    assertCaptureKind(descriptor, requireOption(options, "kind"));
    const revision = requireInteger(options, "revision", 1);
    const version = parseCaptureVersion(
      await requestService(dependencies, `${descriptor.draftsPath}/${revision}`),
      descriptor,
    );
    return captureVersionResult(version, descriptor);
  }

  if (command === "save") {
    assertOnlyOptions(
      options,
      ["session", "kind", "input", "expectedRevision", "style", "styleRevision", "sessionRevision"],
      "capture save",
    );
    const descriptor = await resolveCaptureDescriptor(
      requireOption(options, "session"),
      dependencies,
    );
    assertCaptureKind(descriptor, requireOption(options, "kind"));
    const inputPath = path.resolve(requireOption(options, "input"));
    const document = descriptor.validateDocument(await readJson(inputPath));
    const version = parseCaptureVersion(
      await requestService(dependencies, descriptor.draftsPath, {
        method: "POST",
        body: {
          expectedLatestRevision: requireInteger(options, "expectedRevision", 0),
          draft: document,
          ...(options.style !== undefined || options.styleRevision !== undefined || options.sessionRevision !== undefined
            ? { styleProcessing: {
                styleId: requireOption(options, "style"),
                styleRevision: requireInteger(options, "styleRevision", 1),
                sessionRevision: requireInteger(options, "sessionRevision", 1),
              } }
            : {}),
        },
      }),
      descriptor,
    );
    return captureVersionResult(version, descriptor);
  }

  if (command === "undo") {
    assertOnlyOptions(
      options,
      ["session", "kind", "changeRevision", "expectedRevision"],
      "capture undo",
    );
    const descriptor = await resolveCaptureDescriptor(
      requireOption(options, "session"),
      dependencies,
    );
    assertCaptureKind(descriptor, requireOption(options, "kind"));
    const changeRevision = requireInteger(options, "changeRevision", 1);
    const expectedLatestRevision = requireInteger(options, "expectedRevision", 1);
    const version = parseCaptureVersion(
      await requestService(dependencies, `${descriptor.draftsPath}/undo`, {
        method: "POST",
        body: { changeRevision, expectedLatestRevision },
      }),
      descriptor,
    );
    return {
      ...captureVersionResult(version, descriptor),
      change: {
        type: "undo",
        undoesRevision: changeRevision,
        restoredFromRevision: changeRevision - 1,
      },
    };
  }

  throw new Error(captureUsage());
}

async function resolveCaptureDescriptor(
  sessionId: string,
  dependencies: CliDependencies,
): Promise<CaptureDescriptor> {
  const session = parseSession(
    await requestService(
      dependencies,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    ),
    sessionId,
  );
  return captureDescriptor(session);
}

function captureDescriptor(session: Session): CaptureDescriptor {
  if (session.sessionType === "spatial") return { sessionId: session.id, sessionType: "spatial", captureKind: "spatial-draft", draftsPath: `/api/v1/sessions/${encodeURIComponent(session.id)}/spatial/drafts`, validateDocument: validateSpatialDraft };
  if (session.sessionType === "image-composition") {
    return {
      sessionId: session.id,
      sessionType: session.sessionType,
      captureKind: "composition-draft",
      draftsPath: compositionDraftsPath(session.id),
      validateDocument: validateDraft,
    };
  }
  if (session.sessionType === "ui-layout") {
    return {
      sessionId: session.id,
      sessionType: session.sessionType,
      captureKind: "ui-layout-draft",
      draftsPath: uiSketchDraftsPath(session.id),
      validateDocument: validateUiSketchDraft,
    };
  }
  throw invalidServiceResponse(`unsupported session type: ${session.sessionType}`);
}

function assertCaptureKind(
  descriptor: CaptureDescriptor,
  requestedKind: string,
): void {
  if (requestedKind !== descriptor.captureKind) {
    throw new Error(
      `Session type ${descriptor.sessionType} does not provide capture kind ${requestedKind}.`,
    );
  }
}

function parseCaptureVersion(
  input: unknown,
  descriptor: CaptureDescriptor,
): CaptureVersionPayload {
  const value = requireRecord(input, "capture version");
  if (
    typeof value.id !== "string"
    || value.sessionId !== descriptor.sessionId
    || !Number.isInteger(value.revision)
    || typeof value.fingerprint !== "string"
    || typeof value.createdAt !== "string"
  ) {
    throw invalidServiceResponse("capture version metadata is invalid");
  }
  let document: CaptureDocument;
  try {
    document = descriptor.validateDocument(value.draft);
  } catch (error) {
    throw invalidServiceResponse(`capture document is invalid: ${errorMessage(error)}`);
  }
  return {
    id: value.id,
    sessionId: value.sessionId,
    revision: value.revision as number,
    fingerprint: value.fingerprint,
    document,
    createdAt: value.createdAt,
    ...(value.styleProcessing === undefined ? {} : { styleProcessing: parseStyleProcessing(value.styleProcessing) }),
  };
}

function captureVersionResult(
  version: CaptureVersionPayload,
  descriptor: CaptureDescriptor,
): Record<string, unknown> {
  return {
    version: 1,
    kind: "capture-version",
    sessionId: version.sessionId,
    sessionType: descriptor.sessionType,
    captureKind: descriptor.captureKind,
    id: version.id,
    revision: version.revision,
    fingerprint: version.fingerprint,
    document: version.document,
    createdAt: version.createdAt,
    ...(version.styleProcessing ? { styleProcessing: version.styleProcessing } : {}),
  };
}

function parseStyleProcessing(input: unknown): StyleProcessing {
  const value = requireRecord(input, "style processing");
  if (typeof value.styleId !== "string"
    || !Number.isInteger(value.styleRevision) || Number(value.styleRevision) < 1
    || !Number.isInteger(value.sourceRevision) || Number(value.sourceRevision) < 0
    || !Number.isInteger(value.resultRevision) || Number(value.resultRevision) < 1) {
    throw invalidServiceResponse("style processing metadata is invalid");
  }
  return value as unknown as StyleProcessing;
}

async function inspectLocalDraft(options: CommandOptions): Promise<unknown> {
  assertOnlyOptions(options, ["draft", "preview"], "inspect with --draft");
  const draftPath = path.resolve(requireOption(options, "draft"));
  const draft = validateDraft(await readJson(draftPath));
  const previewPath = options.preview ? path.resolve(options.preview) : null;
  assertArtifactTargets(
    [{ label: "preview", filename: previewPath }],
    [{ label: "draft", filename: draftPath }],
  );
  if (previewPath) await writeFile(previewPath, renderCompositionSvg(draft), "utf8");
  return {
    ...inspectComposition(draft),
    artifacts: { previewSvg: previewPath },
  };
}

async function sessionImageSources(draft: CompositionDraft | UiSketchDraft, sessionId: string, dependencies: CliDependencies) {
  const assets = new Map<string, string>();
  for (const assetId of new Set(draft.images.flatMap(image => image.assetId ? [image.assetId] : []))) {
    const source = await requestService(dependencies, `/api/v1/sessions/${encodeURIComponent(sessionId)}/assets/${encodeURIComponent(assetId)}/content`, { imageSource: true });
    assets.set(assetId, source as string);
  }
  return (assetId: string) => assets.get(assetId);
}

async function renderUiLayoutPreview(options: CommandOptions, dependencies: CliDependencies): Promise<unknown> {
  assertOnlyOptions(options, ["session", "revision", "state", "output"], "ui-layout render");
  const sessionId = requireOption(options, "session");
  const revision = requireInteger(options, "revision", 1);
  const outputPath = path.resolve(requireOption(options, "output"));
  const extension = path.extname(outputPath).toLowerCase();
  if (extension !== ".png" && extension !== ".svg") throw new Error(en.uiSketch.preview.outputFormatError);
  const descriptor = await resolveCaptureDescriptor(sessionId, dependencies);
  assertCaptureKind(descriptor, "ui-layout-draft");
  const version = parseCaptureVersion(await requestService(dependencies, `${descriptor.draftsPath}/${revision}`), descriptor);
  const draft = version.document as UiSketchDraft;
  const tabs = uiSketchStateTabs(draft);
  const stateId = options.state ?? tabs[0].id;
  const state = tabs.find(tab => tab.id === stateId);
  if (!state) throw new Error(en.uiSketch.states.notFound.replace("{{state}}", stateId));
  const selected = uiSketchDraftForStage(draft, state.id);
  const sources = await sessionImageSources({ ...selected, images: selected.images.filter(image => image.visible) }, sessionId, dependencies);
  const svg = renderUiSketchSvg(selected, sources);
  if (extension === ".svg") await writeFile(outputPath, svg, "utf8");
  else await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return {
    version: 1, kind: "ui-layout-preview", sessionId, revision: version.revision, fingerprint: version.fingerprint, state,
    artifact: {
      path: outputPath, mimeType: extension === ".svg" ? "image/svg+xml" : "image/png",
      width: Math.max(1, Math.round(selected.frame.width)), height: Math.max(1, Math.round(selected.frame.height)),
    },
  };
}

async function inspectSessionDraft(
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  assertOnlyOptions(options, ["session", "revision", "preview"], "inspect with --session");
  const sessionId = requireOption(options, "session");
  const revision = requireInteger(options, "revision", 1);
  const version = parseDraftVersion(
    await requestService(
      dependencies,
      `${compositionDraftsPath(sessionId)}/${revision}`,
    ),
  );
  const previewPath = options.preview ? path.resolve(options.preview) : null;
  if (previewPath) {
    await writeFile(previewPath, renderCompositionSvg(version.draft, await sessionImageSources(version.draft, sessionId, dependencies)), "utf8");
  }
  return {
    ...inspectComposition(version.draft),
    source: {
      mode: "session",
      sessionId: version.sessionId,
      draftVersionId: version.id,
      draftRevision: version.revision,
    },
    artifacts: { previewSvg: previewPath },
  };
}

async function applyLocalRefinement(options: CommandOptions): Promise<unknown> {
  assertOnlyOptions(
    options,
    ["draft", "plan", "output", "preview"],
    "apply with --draft",
  );
  const draftPath = path.resolve(requireOption(options, "draft"));
  const planPath = path.resolve(requireOption(options, "plan"));
  const outputPath = options.output ? path.resolve(options.output) : null;
  const previewPath = options.preview ? path.resolve(options.preview) : null;
  assertArtifactTargets(
    [
      { label: "output", filename: outputPath },
      { label: "preview", filename: previewPath },
    ],
    [
      { label: "draft", filename: draftPath },
      { label: "plan", filename: planPath },
    ],
  );
  const draft = validateDraft(await readJson(draftPath));
  const plan = await readJson(planPath);
  const result = applyRefinementPlan(draft, plan);
  const payload = {
    ...result,
    artifacts: {
      result: outputPath,
      previewSvg: previewPath,
    },
  };
  if (outputPath) await writeJson(outputPath, payload);
  if (previewPath) {
    await writeFile(previewPath, renderCompositionSvg(result.refinedDraft), "utf8");
  }
  return payload;
}

async function applySessionRefinement(
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  assertOnlyOptions(
    options,
    ["session", "revision", "plan", "output", "preview"],
    "apply with --session",
  );
  const sessionId = requireOption(options, "session");
  const revision = requireInteger(options, "revision", 1);
  const planPath = path.resolve(requireOption(options, "plan"));
  const outputPath = options.output ? path.resolve(options.output) : null;
  const previewPath = options.preview ? path.resolve(options.preview) : null;
  assertArtifactTargets(
    [
      { label: "output", filename: outputPath },
      { label: "preview", filename: previewPath },
    ],
    [{ label: "plan", filename: planPath }],
  );
  const run = parseRefinementRun(
    await requestService(dependencies, compositionRefinementsPath(sessionId), {
      method: "POST",
      body: {
        sourceDraftRevision: revision,
        plan: await readJson(planPath),
      },
    }),
  );
  return writeSessionRefinementArtifacts(run, options, dependencies);
}

async function writeSessionRefinementArtifacts(
  run: RefinementRunPayload,
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  const outputPath = options.output ? path.resolve(options.output) : null;
  const previewPath = options.preview ? path.resolve(options.preview) : null;
  assertArtifactTargets(
    [
      { label: "output", filename: outputPath },
      { label: "preview", filename: previewPath },
    ],
    [],
  );
  const payload = {
    ...run,
    artifacts: {
      result: outputPath,
      previewSvg: previewPath,
    },
  };
  if (outputPath) await writeJson(outputPath, payload);
  if (previewPath) {
    await writeFile(previewPath, renderCompositionSvg(run.result.refinedDraft, await sessionImageSources(run.result.refinedDraft, run.sessionId, dependencies)), "utf8");
  }
  return payload;
}

async function writeSessionReference(
  options: CommandOptions,
  dependencies: CliDependencies,
): Promise<unknown> {
  assertOnlyOptions(options, ["session", "run", "output"], "reference");
  const sessionId = requireOption(options, "session");
  const runId = requireOption(options, "run");
  const outputPath = path.resolve(requireOption(options, "output"));
  const run = parseRefinementRun(
    await requestService(
      dependencies,
      `${compositionRefinementsPath(sessionId)}/${encodeURIComponent(runId)}`,
    ),
  );
  const draft = run.result.refinedDraft;
  await sharp(Buffer.from(renderCompositionReferenceSvg(draft, await sessionImageSources(draft, sessionId, dependencies)))).png().toFile(outputPath);
  return {
    version: 1,
    kind: "composition-reference",
    sessionId: run.sessionId,
    refinementRunId: run.id,
    sourceDraftRevision: run.sourceDraftRevision,
    sourceFingerprint: run.sourceFingerprint,
    artifact: {
      path: outputPath,
      mimeType: "image/png",
      width: draft.frame.width,
      height: draft.frame.height,
    },
  };
}

function parseOptions(args: string[]): CommandOptions {
  const options: CommandOptions = {};
  const flags = new Set([
    "--agent",
    "--asset",
    "--category",
    "--camera",
    "--box",
    "--view",
    "--views",
    "--change-revision",
    "--check",
    "--creator",
    "--description",
    "--draft",
    "--expected-revision",
    "--input",
    "--kind",
    "--mode",
    "--name",
    "--output",
    "--pass",
    "--plan",
    "--preview",
    "--project",
    "--reference",
    "--revision",
    "--root",
    "--run",
    "--session",
    "--state",
    "--style",
    "--style-revision",
    "--session-revision",
    "--summary",
    "--title",
    "--type",
    "--unassigned",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flags.has(flag)) throw new Error(`Unknown option: ${flag}.`);
    const key = flagToOptionKey(flag);
    if (options[key] !== undefined) throw new Error(`Duplicate option: ${flag}.`);
    if (flag === "--check") {
      options.check = true;
      continue;
    }
    if (flag === "--unassigned") {
      options.unassigned = true;
      continue;
    }
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    (options as Record<string, string | boolean | undefined>)[key] = value;
  }
  return options;
}

function flagToOptionKey(flag: string): keyof CommandOptions {
  if (flag === "--style-revision") return "styleRevision";
  if (flag === "--session-revision") return "sessionRevision";
  if (flag === "--change-revision") return "changeRevision";
  if (flag === "--expected-revision") return "expectedRevision";
  return flag.slice(2) as keyof CommandOptions;
}

function requireOption(options: CommandOptions, key: keyof CommandOptions): string {
  const value = options[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`--${optionKeyToFlag(key)} is required.`);
  }
  return value;
}

function requireInteger(
  options: CommandOptions,
  key: keyof CommandOptions,
  minimum: number,
): number {
  const value = requireOption(options, key);
  if (!/^(0|[1-9][0-9]*)$/.test(value) || Number(value) < minimum) {
    throw new Error(`--${optionKeyToFlag(key)} must be an integer of at least ${minimum}.`);
  }
  return Number(value);
}

function optionKeyToFlag(key: keyof CommandOptions): string {
  if (key === "styleRevision") return "style-revision";
  if (key === "sessionRevision") return "session-revision";
  if (key === "changeRevision") return "change-revision";
  return key === "expectedRevision" ? "expected-revision" : key;
}

function parseGlobalOptions(args: string[]): {
  options: CliGlobalOptions;
  commandArgs: string[];
} {
  const options: CliGlobalOptions = {};
  let index = 0;
  while (args[index] === "--api-url" || args[index] === "--web-url") {
    const flag = args[index];
    const key = flag === "--api-url" ? "apiUrl" : "webUrl";
    if (options[key] !== undefined) throw new Error(`Duplicate option: ${flag}.`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    configuredHttpUrl(value, flag);
    options[key] = value;
    index += 2;
  }
  return { options, commandArgs: args.slice(index) };
}

function assertOnlyOptions(
  options: CommandOptions,
  allowed: Array<keyof CommandOptions>,
  command: string,
): void {
  const unexpected = (Object.keys(options) as Array<keyof CommandOptions>).filter(
    (key) => options[key] !== undefined && !allowed.includes(key),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `${command} does not accept ${unexpected.map((key) => `--${optionKeyToFlag(key)}`).join(", ")}.`,
    );
  }
}

function assertExclusiveProjectTarget(
  options: CommandOptions,
  optional: boolean,
): void {
  if (options.project && options.unassigned) {
    throw new Error("--project and --unassigned cannot be used together.");
  }
  if (!optional && !options.project && !options.unassigned) {
    throw new Error("Either --project or --unassigned is required.");
  }
}

function assertArtifactTargets(
  artifacts: Array<{ label: string; filename: string | null }>,
  inputs: Array<{ label: string; filename: string }>,
): void {
  const presentArtifacts = artifacts.filter(
    (artifact): artifact is { label: string; filename: string } => Boolean(artifact.filename),
  );
  for (const artifact of presentArtifacts) {
    const protectedInput = inputs.find((input) => input.filename === artifact.filename);
    if (protectedInput) {
      throw new Error(`--${artifact.label} must not overwrite the ${protectedInput.label} file.`);
    }
    const duplicate = presentArtifacts.find(
      (candidate) => candidate !== artifact && candidate.filename === artifact.filename,
    );
    if (duplicate) {
      throw new Error(`--${artifact.label} and --${duplicate.label} must use different files.`);
    }
  }
}

async function requestService(
  dependencies: CliDependencies,
  pathname: string,
  request: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; svgSource?: boolean; png?: boolean; imageSource?: boolean } = {},
): Promise<unknown> {
  const url = new URL(pathname, configuredServiceUrl(dependencies));
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: request.method ?? "GET",
      headers: request.body === undefined ? undefined : { "content-type": "application/json" },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
  } catch (error) {
    throw new CliServiceError(
      "SERVICE_UNAVAILABLE",
      `Cannot connect to Human2AI service at ${url.origin}: ${errorMessage(error)}`,
      null,
    );
  }

  if (response.ok && request.imageSource) {
    const mime = response.headers.get("content-type")?.split(";")[0].trim();
    if (!mime || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(mime)) throw invalidServiceResponse("Expected an image asset");
    return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  }
  if (response.ok && request.png) {
    if (response.headers.get("content-type")?.split(";")[0].trim() !== "image/png") throw invalidServiceResponse("Expected a camera PNG");
    return Buffer.from(await response.arrayBuffer());
  }
  if (response.ok && request.svgSource) {
    if (response.headers.get("content-type")?.split(";")[0].trim() !== "image/svg+xml") {
      throw new CliServiceError("INVALID_IMAGE_ASSET", "Source is available only for SVG images.", 400);
    }
    return response.text();
  }
  const payload = response.status === 204 ? null : await readResponseJson(response);
  if (!response.ok) {
    const error = isRecord(payload) ? payload : {};
    const code = typeof error.code === "string" ? error.code : `HTTP_${response.status}`;
    const message =
      typeof error.message === "string"
        ? error.message
        : `Human2AI service request failed with HTTP ${response.status}`;
    const details = Object.fromEntries(
      Object.entries(error).filter(([key]) => key !== "code" && key !== "message"),
    );
    throw new CliServiceError(code, message, response.status, details);
  }
  return payload;
}

async function requestImageService(
  dependencies: CliDependencies,
  pathname: string,
  body: Buffer,
): Promise<unknown> {
  const url = new URL(pathname, configuredServiceUrl(dependencies));
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body,
    });
  } catch (error) {
    throw new CliServiceError(
      "SERVICE_UNAVAILABLE",
      `Cannot connect to Human2AI service at ${url.origin}: ${errorMessage(error)}`,
      null,
    );
  }
  const payload = await readResponseJson(response);
  if (!response.ok) {
    const error = isRecord(payload) ? payload : {};
    throw new CliServiceError(
      typeof error.code === "string" ? error.code : `HTTP_${response.status}`,
      typeof error.message === "string"
        ? error.message
        : `Human2AI service request failed with HTTP ${response.status}`,
      response.status,
      Object.fromEntries(
        Object.entries(error).filter(([key]) => key !== "code" && key !== "message"),
      ),
    );
  }
  return payload;
}

function configuredServiceUrl(
  dependencies: CliDependencies,
  defaultUrl = resolveRuntimeDefaults(dependencies.integrationSourceRoot).apiUrl,
): URL {
  const integration = dependencies.serviceUrl || process.env.HUMAN2AI_SERVER_URL
    ? null
    : readIntegrationManifestSync(integrationStartDirectory(dependencies.cwd));
  return configuredHttpUrl(
    dependencies.serviceUrl
      ?? process.env.HUMAN2AI_SERVER_URL
      ?? integration?.service.apiUrl
      ?? defaultUrl,
    "HUMAN2AI_SERVER_URL",
  );
}

function configuredWebUrl(dependencies: CliDependencies, defaultUrl?: string): URL {
  const integration = dependencies.webUrl || process.env.HUMAN2AI_WEB_URL
    ? null
    : readIntegrationManifestSync(integrationStartDirectory(dependencies.cwd));
  return configuredHttpUrl(
    dependencies.webUrl
      ?? process.env.HUMAN2AI_WEB_URL
      ?? integration?.service.webUrl
      ?? defaultUrl
      ?? (dependencies.serviceUrl || process.env.HUMAN2AI_SERVER_URL
        ? undefined
        : resolveRuntimeDefaults(dependencies.integrationSourceRoot).webUrl)
      ?? configuredServiceUrl(dependencies).origin,
    "HUMAN2AI_WEB_URL",
  );
}

function configuredHttpUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must use http or https.`);
  }
  return url;
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new CliServiceError(
      "INVALID_SERVICE_RESPONSE",
      `Human2AI service returned invalid JSON with HTTP ${response.status}`,
      response.status,
    );
  }
}

function parseDraftVersion(input: unknown): DraftVersionPayload {
  const value = requireRecord(input, "draft version");
  if (
    typeof value.id !== "string" ||
    typeof value.sessionId !== "string" ||
    !Number.isInteger(value.revision) ||
    typeof value.fingerprint !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw invalidServiceResponse("draft version metadata is invalid");
  }
  return {
    id: value.id,
    sessionId: value.sessionId,
    revision: value.revision as number,
    fingerprint: value.fingerprint,
    draft: validateServiceDraft(value.draft),
    createdAt: value.createdAt,
  };
}

function parseSession(input: unknown, expectedId: string): Session {
  const value = requireRecord(input, "session");
  if (
    value.id !== expectedId
    || (value.projectId !== null && typeof value.projectId !== "string")
    || (value.styleId != null && typeof value.styleId !== "string")
    || typeof value.sessionType !== "string"
    || !SESSION_TYPES.includes(value.sessionType as SessionType)
    || typeof value.title !== "string"
    || !["draft", "interpreted", "approved", "exported"].includes(
      String(value.lifecycleStage),
    )
    || !Number.isInteger(value.revision)
    || typeof value.createdAt !== "string"
    || typeof value.updatedAt !== "string"
  ) {
    throw invalidServiceResponse("session metadata is invalid");
  }
  return { ...value, styleId: value.styleId ?? null } as unknown as Session;
}

function parseRefinementRun(input: unknown): RefinementRunPayload {
  const value = requireRecord(input, "refinement run");
  const result = requireRecord(value.result, "refinement result");
  if (
    typeof value.id !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.sourceDraftVersionId !== "string" ||
    !Number.isInteger(value.sourceDraftRevision) ||
    typeof value.sourceFingerprint !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw invalidServiceResponse("refinement run metadata is invalid");
  }
  return {
    id: value.id,
    sessionId: value.sessionId,
    sourceDraftVersionId: value.sourceDraftVersionId,
    sourceDraftRevision: value.sourceDraftRevision as number,
    sourceFingerprint: value.sourceFingerprint,
    plan: value.plan,
    result: {
      ...result,
      refinedDraft: validateServiceDraft(result.refinedDraft),
    } as unknown as CompositionRefinementResult,
    createdAt: value.createdAt,
  };
}

function validateServiceDraft(input: unknown): CompositionDraft {
  try {
    return validateDraft(input);
  } catch (error) {
    throw invalidServiceResponse(`composition draft is invalid: ${errorMessage(error)}`);
  }
}

function requireRecord(input: unknown, label: string): Record<string, unknown> {
  if (!isRecord(input)) throw invalidServiceResponse(`${label} is not an object`);
  return input;
}

function invalidServiceResponse(message: string): CliServiceError {
  return new CliServiceError("INVALID_SERVICE_RESPONSE", message, null);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function compositionDraftsPath(sessionId: string): string {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/composition/drafts`;
}

function uiSketchDraftsPath(sessionId: string): string {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/ui-sketch/drafts`;
}

function compositionRefinementsPath(sessionId: string): string {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/composition/refinements`;
}

async function readJson(filename: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(filename), "utf8"));
}

async function writeJson(filename: string, value: unknown): Promise<void> {
  await writeFile(path.resolve(filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usage(): string {
  return [
    "Usage:",
    "  human2ai [--api-url <url>] [--web-url <url>] <command>",
    "  human2ai web",
    ...serviceUsage().split("\n").slice(1),
    ...integrationUsage().split("\n").slice(1),
    ...projectUsage().split("\n").slice(1),
    ...sessionUsage().split("\n").slice(1),
    ...captureUsage().split("\n").slice(1),
    ...styleUsage().split("\n").slice(1),
    ...imageUsage().split("\n").slice(1),
    "  human2ai ui-layout standardize --input <document.json> --output <standardized.json> [--plan <alignment-plan.json>]",
    "  human2ai ui-layout render --session <id> --revision <n> [--state <state-id>] --output <preview.png|preview.svg>",
    "  human2ai spatial methods",
    "  human2ai spatial inspect --session <id> --revision <n> [--output <inspection.json>]",
    "  human2ai spatial apply --session <id> --revision <n> --input <operations.json> [--output <version.json>]",
    "  human2ai spatial render --session <id> --revision <n> --camera <id> [--pass color|structure|depth|skeleton] --output <camera.png>",
    "  human2ai spatial render --session <id> --revision <n> --box <id> [--view sheet|front|back|left|right|top|bottom] [--pass color|structure|depth|skeleton] --output <reference.png>",
    "  human2ai spatial render --session <id> --revision <n> --box <id> --views <front,left,top> [--pass color|structure|depth|skeleton] --output <reference.png>",
    "  human2ai composition methods",
    "  human2ai composition save --session <id> --draft <draft.json> --expected-revision <n>",
    "  human2ai composition drafts --session <id>",
    "  human2ai composition inspect --draft <draft.json> [--preview <preview.svg>]",
    "  human2ai composition inspect --session <id> --revision <n> [--preview <preview.svg>]",
    "  human2ai composition apply --draft <draft.json> --plan <plan.json> [--output <result.json>] [--preview <preview.svg>]",
    "  human2ai composition apply --session <id> --revision <n> --plan <plan.json> [--output <run.json>] [--preview <preview.svg>]",
    "  human2ai composition refinements --session <id>",
    "  human2ai composition refinement --session <id> --run <id> [--output <run.json>] [--preview <preview.svg>]",
    "  human2ai composition reference --session <id> --run <id> --output <reference.png>",
  ].join("\n");
}

function imageUsage(): string {
  return [
    "Image usage:",
    "  human2ai image upload --session <id> --input <image-file>",
    "  human2ai image source --session <id> --asset <id> [--output <image.svg>]",
  ].join("\n");
}

function styleUsage(): string {
  return [
    "Style usage:",
    "  human2ai style list [--category <visual|ui|spatial>] [--creator <user|agent>]",
    "  human2ai style get --style <id>",
    "  human2ai style create --name <name> --category <visual|ui|spatial> --description <text> [--summary <sentence>]",
    "  human2ai style update --style <id> --expected-revision <n> [--name <name>] [--category <visual|ui|spatial>] [--description <text>] [--summary <sentence>]",
    "  human2ai style set-model --style <id> --input <generated.glb> --expected-revision <n>",
    "  human2ai style remove-model --style <id> --expected-revision <n>",
    "  human2ai style add-reference --style <id> --input <image> --expected-revision <n>",
    "  human2ai style remove-reference --style <id> --reference <id> --expected-revision <n>",
    "  human2ai style delete --style <id> --expected-revision <n>",
  ].join("\n");
}

function captureUsage(): string {
  return [
    "Capture usage:",
    "  human2ai capture list --session <id>",
    "  human2ai capture get --session <id> --kind <kind> --revision <n>",
    "  human2ai capture save --session <id> --kind <kind> --input <document.json> --expected-revision <n> [--style <id> --style-revision <n> --session-revision <n>]",
    "  human2ai capture undo --session <id> --kind <kind> --change-revision <n> --expected-revision <n>",
  ].join("\n");
}

function serviceUsage(): string {
  return [
    "Service usage:",
    "  human2ai service status",
  ].join("\n");
}

function projectUsage(): string {
  return [
    "Project usage:",
    "  human2ai project list",
    "  human2ai project create --name <name> [--description <text>]",
    "  human2ai project get --project <id>",
    "  human2ai project update --project <id> --expected-revision <n> [--name <name>] [--description <text>]",
  ].join("\n");
}

function sessionUsage(): string {
  return [
    "Session usage:",
    "  human2ai session list [--project <id> | --unassigned]",
    "  human2ai session create --type <image-composition|ui-layout|spatial> --title <title> [--project <id>]",
    "  human2ai session get --session <id>",
    "  human2ai session connect --session <id>",
    "  human2ai session open --session <id>",
    "  human2ai session style --session <id>",
    "  human2ai session bind-style --session <id> --style <id> --expected-revision <n>",
    "  human2ai session unbind-style --session <id> --expected-revision <n>",
    "  human2ai session move --session <id> (--project <id> | --unassigned) --expected-revision <n>",
  ].join("\n");
}

async function main(): Promise<void> {
  try {
    const invocation = parseGlobalOptions(process.argv.slice(2));
    if (invocation.commandArgs[0] === "web") {
      if (invocation.options.apiUrl || invocation.options.webUrl) {
        throw new Error("human2ai web does not accept --api-url or --web-url.");
      }
      await web(invocation.commandArgs.slice(1));
      return;
    }
    const result = await executeCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const payload = {
      error: {
        code:
          error instanceof CliServiceError || error instanceof CliIntegrationError
            ? error.code
            : error instanceof RefinementConstraintError
              ? "REFINEMENT_CONSTRAINT"
              : "INVALID_REQUEST",
        message: errorMessage(error),
        ...(error instanceof CliServiceError || error instanceof CliIntegrationError
          ? error.details
          : {}),
        ...(error instanceof RefinementConstraintError ? { audit: error.audit } : {}),
      },
    };
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 1;
  }
}

async function openExternalUrl(url: string): Promise<void> {
  const target = configuredHttpUrl(url, "session UI URL").toString();
  const command = process.platform === "darwin"
    ? { executable: "open", args: [target] }
    : process.platform === "win32"
      ? { executable: "cmd", args: ["/c", "start", "", target] }
      : { executable: "xdg-open", args: [target] };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function web(args: string[]): Promise<void> {
  if (args.length > 0) throw new Error(usage());

  const { startHuman2AiWeb } = await import("../server/runtime.ts");
  const running = await startHuman2AiWeb();
  if (running.status === "already-running") {
    process.stdout.write(
      `${JSON.stringify({ status: running.status, url: running.url }, null, 2)}\n`,
    );
    return;
  }
  process.stdout.write(
    `${JSON.stringify({ status: "listening", url: running.url }, null, 2)}\n`,
  );

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try {
      await running.server.close();
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ error: { code: "SHUTDOWN_FAILED", message: errorMessage(error) } }, null, 2)}\n`,
      );
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}

if (isMainModule()) {
  await main();
}

export function isMainModule(entryPath = process.argv[1]): boolean {
  if (!entryPath) return false;
  try {
    return (
      realpathSync(path.resolve(entryPath)) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

function styleModelUrl(value: unknown): string {
  const model = requireRecord(value, "style model");
  if (typeof model.url !== "string") throw invalidServiceResponse("style model URL is invalid");
  return model.url;
}
