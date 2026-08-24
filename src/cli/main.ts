#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  RefinementConstraintError,
  applyRefinementPlan,
  inspectComposition,
  refinementMethods,
  refinementPlanSchema,
  renderCompositionSvg,
  validateDraft,
  type CompositionDraft,
  type CompositionRefinementResult,
} from "../domain/composition/index.ts";

const DEFAULT_SERVICE_URL = "http://127.0.0.1:4179";

interface CommandOptions {
  description?: string;
  draft?: string;
  expectedRevision?: string;
  name?: string;
  output?: string;
  plan?: string;
  preview?: string;
  project?: string;
  revision?: string;
  run?: string;
  session?: string;
  title?: string;
  type?: string;
  unassigned?: boolean;
}

export interface CliDependencies {
  fetch?: typeof fetch;
  serviceUrl?: string;
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
  const scope = args[0];
  const command = args[1];
  const options = parseOptions(args.slice(2));

  if (scope === "project") {
    return executeProjectCommand(command, options, dependencies);
  }
  if (scope === "session") {
    return executeSessionCommand(command, options, dependencies);
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
      await requestService(dependencies, compositionDraftsPath(sessionId), {
        method: "POST",
        body: { expectedLatestRevision, draft },
      }),
    );
  }

  if (command === "drafts") {
    assertOnlyOptions(options, ["session"], "drafts");
    const sessionId = requireOption(options, "session");
    return requestService(dependencies, compositionDraftsPath(sessionId));
  }

  if (command === "inspect") {
    return options.session
      ? inspectSessionDraft(options, dependencies)
      : inspectLocalDraft(options);
  }

  if (command === "apply") {
    return options.session
      ? applySessionRefinement(options, dependencies)
      : applyLocalRefinement(options);
  }

  if (command === "refinements") {
    assertOnlyOptions(options, ["session"], "refinements");
    const sessionId = requireOption(options, "session");
    return requestService(dependencies, compositionRefinementsPath(sessionId));
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
        dependencies,
        `${compositionRefinementsPath(sessionId)}/${encodeURIComponent(runId)}`,
      ),
    );
    return writeSessionRefinementArtifacts(run, options);
  }

  throw new Error(usage());
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
    await writeFile(previewPath, renderCompositionSvg(version.draft), "utf8");
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
  return writeSessionRefinementArtifacts(run, options);
}

async function writeSessionRefinementArtifacts(
  run: RefinementRunPayload,
  options: CommandOptions,
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
    await writeFile(previewPath, renderCompositionSvg(run.result.refinedDraft), "utf8");
  }
  return payload;
}

function parseOptions(args: string[]): CommandOptions {
  const options: CommandOptions = {};
  const flags = new Set([
    "--description",
    "--draft",
    "--expected-revision",
    "--name",
    "--output",
    "--plan",
    "--preview",
    "--project",
    "--revision",
    "--run",
    "--session",
    "--title",
    "--type",
    "--unassigned",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flags.has(flag)) throw new Error(`Unknown option: ${flag}.`);
    const key = flagToOptionKey(flag);
    if (options[key] !== undefined) throw new Error(`Duplicate option: ${flag}.`);
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
  return key === "expectedRevision" ? "expected-revision" : key;
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
  request: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<unknown> {
  const serviceUrl =
    dependencies.serviceUrl ?? process.env.HUMAN2AI_SERVER_URL ?? DEFAULT_SERVICE_URL;
  const url = serviceRequestUrl(serviceUrl, pathname);
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

  const payload = await readResponseJson(response);
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

function serviceRequestUrl(serviceUrl: string, pathname: string): URL {
  let baseUrl: URL;
  try {
    baseUrl = new URL(serviceUrl);
  } catch {
    throw new Error(`Invalid HUMAN2AI_SERVER_URL: ${serviceUrl}`);
  }
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("HUMAN2AI_SERVER_URL must use http or https.");
  }
  return new URL(pathname, baseUrl);
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
    "  human2ai web",
    ...projectUsage().split("\n").slice(1),
    ...sessionUsage().split("\n").slice(1),
    "  human2ai composition methods",
    "  human2ai composition save --session <id> --draft <draft.json> --expected-revision <n>",
    "  human2ai composition drafts --session <id>",
    "  human2ai composition inspect --draft <draft.json> [--preview <preview.svg>]",
    "  human2ai composition inspect --session <id> --revision <n> [--preview <preview.svg>]",
    "  human2ai composition apply --draft <draft.json> --plan <plan.json> [--output <result.json>] [--preview <preview.svg>]",
    "  human2ai composition apply --session <id> --revision <n> --plan <plan.json> [--output <run.json>] [--preview <preview.svg>]",
    "  human2ai composition refinements --session <id>",
    "  human2ai composition refinement --session <id> --run <id> [--output <run.json>] [--preview <preview.svg>]",
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
    "  human2ai session create --type <image-composition|ui-layout> --title <title> [--project <id>]",
    "  human2ai session get --session <id>",
    "  human2ai session move --session <id> (--project <id> | --unassigned) --expected-revision <n>",
  ].join("\n");
}

async function main(): Promise<void> {
  try {
    if (process.argv[2] === "web") {
      await web(process.argv.slice(3));
      return;
    }
    const result = await executeCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const payload = {
      error: {
        code:
          error instanceof CliServiceError
            ? error.code
            : error instanceof RefinementConstraintError
              ? "REFINEMENT_CONSTRAINT"
              : "INVALID_REQUEST",
        message: errorMessage(error),
        ...(error instanceof CliServiceError ? error.details : {}),
        ...(error instanceof RefinementConstraintError ? { audit: error.audit } : {}),
      },
    };
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 1;
  }
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
