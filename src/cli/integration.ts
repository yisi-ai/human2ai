import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  HUMAN2AI_PACKAGE_ROOT as DEFAULT_SOURCE_ROOT,
  isDevelopmentSource,
} from "../runtime-defaults.ts";

const INTEGRATION_CONFIG = path.join(".human2ai", "integration.json");
const INTEGRATION_IGNORE = path.join(".human2ai", ".gitignore");
const SKILL_TARGET = path.join(".agents", "skills", "human2ai");

export type IntegrationMode = "copy" | "link";

export interface IntegrationManifest {
  schemaVersion: 1;
  agent: "codex";
  sourceRoot: string;
  runner: string[];
  service: {
    apiUrl: string;
    start: string[];
    webUrl: string;
  };
  skill: {
    name: "human2ai";
    mode: IntegrationMode;
    target: ".agents/skills/human2ai";
    sourceDigest: string;
  };
}

export interface IntegrationCommandOptions {
  agent?: string;
  check?: boolean;
  mode?: string;
  root?: string;
}

export interface IntegrationContext {
  apiUrl: string;
  sourceRoot?: string;
  startDirectory?: string;
  webUrl: string;
}

export class CliIntegrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CliIntegrationError";
  }
}

export async function executeIntegrationCommand(
  command: string | undefined,
  options: IntegrationCommandOptions,
  context: IntegrationContext,
): Promise<unknown> {
  const root = await requireProjectRoot(
    options.root ?? integrationStartDirectory(context.startDirectory),
  );
  const sourceRoot = await resolveSourceRoot(context.sourceRoot);

  if (command === "install") {
    const agent = options.agent ?? "codex";
    if (agent !== "codex") {
      throw new CliIntegrationError(
        "UNSUPPORTED_AGENT",
        `Unsupported integration agent: ${agent}.`,
        { supportedAgents: ["codex"] },
      );
    }
    const mode = parseMode(options.mode ?? "copy");
    return installIntegration(root, sourceRoot, mode, context);
  }

  if (command === "sync") {
    return syncIntegration(root, sourceRoot, options.check === true);
  }

  if (command === "doctor") {
    return diagnoseIntegration(root, sourceRoot);
  }

  throw new Error(integrationUsage());
}

export function readIntegrationManifestSync(
  startDirectory = integrationStartDirectory(),
): IntegrationManifest | null {
  let directory = path.resolve(startDirectory);
  while (true) {
    const configPath = path.join(directory, INTEGRATION_CONFIG);
    if (existsSync(configPath)) {
      try {
        return parseManifest(JSON.parse(readFileSync(configPath, "utf8")), configPath);
      } catch (error) {
        if (error instanceof CliIntegrationError) throw error;
        throw invalidConfig(configPath, error);
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory || existsSync(path.join(directory, ".git"))) return null;
    directory = parent;
  }
}

export function integrationStartDirectory(
  explicitDirectory?: string,
): string {
  return path.resolve(
    explicitDirectory
      ?? process.env.HUMAN2AI_INTEGRATION_ROOT
      ?? process.env.INIT_CWD
      ?? process.cwd(),
  );
}

export function integrationUsage(): string {
  return [
    "Integration usage:",
    "  human2ai integration install [--agent codex] [--root <path>] [--mode copy|link]",
    "  human2ai integration sync [--root <path>] [--check]",
    "  human2ai integration doctor [--root <path>]",
  ].join("\n");
}

async function installIntegration(
  root: string,
  sourceRoot: string,
  mode: IntegrationMode,
  context: IntegrationContext,
): Promise<unknown> {
  const configPath = path.join(root, INTEGRATION_CONFIG);
  const targetPath = path.join(root, SKILL_TARGET);
  const sourcePath = skillSourcePath(sourceRoot);
  const sourceDigest = await hashDirectory(sourcePath);
  const existing = await readManifest(configPath, false);

  if (existing) {
    assertSameSource(existing, sourceRoot);
    assertManifestRunners(existing, sourceRoot);
    if (existing.skill.mode !== mode) {
      throw new CliIntegrationError(
        "INTEGRATION_CONFLICT",
        `Human2AI is already installed in ${existing.skill.mode} mode.`,
        { configPath, installedMode: existing.skill.mode, requestedMode: mode },
      );
    }
    await assertManagedTarget(existing, root);
    return integrationResult(
      "integration-install",
      existing.skill.sourceDigest === sourceDigest ? "already-installed" : "update-available",
      root,
      existing,
      false,
      sourceDigest,
    );
  }

  if (await pathExists(targetPath)) {
    throw new CliIntegrationError(
      "INTEGRATION_CONFLICT",
      `Refusing to overwrite unmanaged Skill at ${targetPath}.`,
      { targetPath },
    );
  }

  const manifest: IntegrationManifest = {
    schemaVersion: 1,
    agent: "codex",
    sourceRoot,
    runner: localRunner(sourceRoot),
    service: {
      apiUrl: context.apiUrl,
      start: localServiceRunner(sourceRoot),
      webUrl: context.webUrl,
    },
    skill: {
      name: "human2ai",
      mode,
      target: ".agents/skills/human2ai",
      sourceDigest,
    },
  };

  await mkdir(path.dirname(targetPath), { recursive: true });
  if (mode === "copy") {
    await cp(sourcePath, targetPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  } else {
    await symlink(sourcePath, targetPath, "dir");
  }
  try {
    await ensureIntegrationConfigIgnored(root);
    await writeManifest(configPath, manifest);
  } catch (error) {
    await rm(targetPath, { recursive: true, force: true });
    throw error;
  }

  return integrationResult(
    "integration-install",
    "installed",
    root,
    manifest,
    true,
    sourceDigest,
  );
}

async function syncIntegration(
  root: string,
  sourceRoot: string,
  check: boolean,
): Promise<unknown> {
  const configPath = path.join(root, INTEGRATION_CONFIG);
  const manifest = await requireManifest(configPath);
  assertSameSource(manifest, sourceRoot);
  assertManifestRunners(manifest, sourceRoot);
  await assertManagedTarget(manifest, root);

  const sourceDigest = await hashDirectory(skillSourcePath(sourceRoot));
  if (manifest.skill.mode === "link") {
    if (!check && manifest.skill.sourceDigest !== sourceDigest) {
      const updated = withSourceDigest(manifest, sourceDigest);
      await writeManifest(configPath, updated);
      return integrationResult(
        "integration-sync",
        "metadata-updated",
        root,
        updated,
        true,
        sourceDigest,
      );
    }
    return integrationResult(
      "integration-sync",
      "current",
      root,
      manifest,
      false,
      sourceDigest,
    );
  }

  if (manifest.skill.sourceDigest === sourceDigest) {
    return integrationResult(
      "integration-sync",
      "current",
      root,
      manifest,
      false,
      sourceDigest,
    );
  }
  if (check) {
    return integrationResult(
      "integration-sync",
      "update-available",
      root,
      manifest,
      false,
      sourceDigest,
    );
  }

  const targetPath = path.join(root, manifest.skill.target);
  await replaceDirectory(skillSourcePath(sourceRoot), targetPath);
  const updated = withSourceDigest(manifest, sourceDigest);
  await writeManifest(configPath, updated);
  return integrationResult(
    "integration-sync",
    "updated",
    root,
    updated,
    true,
    sourceDigest,
  );
}

async function diagnoseIntegration(
  root: string,
  sourceRoot: string,
): Promise<unknown> {
  const configPath = path.join(root, INTEGRATION_CONFIG);
  const manifest = await requireManifest(configPath);
  assertSameSource(manifest, sourceRoot);
  assertManifestRunners(manifest, sourceRoot);
  await assertManagedTarget(manifest, root);
  const sourceDigest = await hashDirectory(skillSourcePath(sourceRoot));
  const updateAvailable = manifest.skill.mode === "copy"
    && manifest.skill.sourceDigest !== sourceDigest;

  return {
    version: 1,
    kind: "integration-doctor",
    status: updateAvailable ? "update-available" : "ready",
    root,
    configPath,
    sourceRoot,
    runner: manifest.runner,
    service: manifest.service,
    skill: {
      ...manifest.skill,
      targetPath: path.join(root, manifest.skill.target),
      currentSourceDigest: sourceDigest,
      updateAvailable,
    },
    checks: [
      { id: "integration.config@1", status: "passed" },
      { id: "integration.source@1", status: "passed" },
      { id: "integration.runner@1", status: "passed" },
      { id: "integration.skill@1", status: "passed" },
    ],
  };
}

async function assertManagedTarget(
  manifest: IntegrationManifest,
  root: string,
): Promise<void> {
  const targetPath = path.join(root, manifest.skill.target);
  let targetStat;
  try {
    targetStat = await lstat(targetPath);
  } catch (error) {
    if (isNotFound(error)) {
      throw new CliIntegrationError(
        "INTEGRATION_CONFLICT",
        `Managed Human2AI Skill is missing at ${targetPath}.`,
        { targetPath },
      );
    }
    throw error;
  }

  if (manifest.skill.mode === "link") {
    if (!targetStat.isSymbolicLink()) {
      throw new CliIntegrationError(
        "INTEGRATION_CONFLICT",
        `Managed Human2AI Skill at ${targetPath} is no longer a symbolic link.`,
        { targetPath },
      );
    }
    const linkedPath = path.resolve(path.dirname(targetPath), await readlink(targetPath));
    const expectedPath = skillSourcePath(manifest.sourceRoot);
    if (await realpath(linkedPath) !== await realpath(expectedPath)) {
      throw new CliIntegrationError(
        "INTEGRATION_CONFLICT",
        `Managed Human2AI Skill link at ${targetPath} points to a different source.`,
        { targetPath, expectedPath, linkedPath },
      );
    }
    return;
  }

  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
    throw new CliIntegrationError(
      "INTEGRATION_CONFLICT",
      `Managed Human2AI Skill at ${targetPath} is not a copied directory.`,
      { targetPath },
    );
  }
  const installedDigest = await hashDirectory(targetPath);
  if (installedDigest !== manifest.skill.sourceDigest) {
    throw new CliIntegrationError(
      "INTEGRATION_CONFLICT",
      "The copied Human2AI Skill was modified in the consumer project; refusing to overwrite it.",
      {
        targetPath,
        expectedDigest: manifest.skill.sourceDigest,
        installedDigest,
      },
    );
  }
}

async function replaceDirectory(sourcePath: string, targetPath: string): Promise<void> {
  const parent = path.dirname(targetPath);
  const stagingPath = path.join(parent, `.human2ai-stage-${randomUUID()}`);
  const backupPath = path.join(parent, `.human2ai-backup-${randomUUID()}`);
  await cp(sourcePath, stagingPath, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await rename(targetPath, backupPath);
  try {
    await rename(stagingPath, targetPath);
  } catch (error) {
    await rename(backupPath, targetPath);
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
  await rm(backupPath, { recursive: true, force: true });
}

async function hashDirectory(directory: string): Promise<string> {
  const directoryStat = await stat(directory);
  if (!directoryStat.isDirectory()) {
    throw new CliIntegrationError(
      "INTEGRATION_SOURCE_INVALID",
      `Human2AI Skill source is not a directory: ${directory}.`,
      { directory },
    );
  }
  const hash = createHash("sha256");
  await hashDirectoryEntries(directory, directory, hash);
  return `sha256:${hash.digest("hex")}`;
}

async function hashDirectoryEntries(
  root: string,
  directory: string,
  hash: ReturnType<typeof createHash>,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename).split(path.sep).join("/");
    if (entry.isDirectory()) {
      hash.update(`directory\0${relative}\0`);
      await hashDirectoryEntries(root, filename, hash);
    } else if (entry.isFile()) {
      hash.update(`file\0${relative}\0`);
      hash.update(await readFile(filename));
      hash.update("\0");
    } else if (entry.isSymbolicLink()) {
      hash.update(`link\0${relative}\0${await readlink(filename)}\0`);
    } else {
      throw new CliIntegrationError(
        "INTEGRATION_SOURCE_INVALID",
        `Unsupported file type in Human2AI Skill: ${filename}.`,
        { filename },
      );
    }
  }
}

async function resolveSourceRoot(explicitRoot?: string): Promise<string> {
  const root = path.resolve(
    explicitRoot ?? DEFAULT_SOURCE_ROOT,
  );
  try {
    const resolved = await realpath(root);
    await hashDirectory(skillSourcePath(resolved));
    return resolved;
  } catch (error) {
    if (error instanceof CliIntegrationError) throw error;
    throw new CliIntegrationError(
      "INTEGRATION_SOURCE_INVALID",
      `Cannot read the local Human2AI source at ${root}.`,
      { sourceRoot: root },
    );
  }
}

async function requireProjectRoot(root: string): Promise<string> {
  const resolved = path.resolve(root);
  try {
    if (!(await stat(resolved)).isDirectory()) throw new Error("not a directory");
    return await realpath(resolved);
  } catch {
    throw new CliIntegrationError(
      "INTEGRATION_ROOT_INVALID",
      `Consumer project root is not a directory: ${resolved}.`,
      { root: resolved },
    );
  }
}

async function readManifest(
  configPath: string,
  required: boolean,
): Promise<IntegrationManifest | null> {
  try {
    return parseManifest(JSON.parse(await readFile(configPath, "utf8")), configPath);
  } catch (error) {
    if (isNotFound(error) && !required) return null;
    if (isNotFound(error)) {
      throw new CliIntegrationError(
        "INTEGRATION_NOT_INSTALLED",
        `Human2AI integration is not installed at ${path.dirname(configPath)}.`,
        { configPath },
      );
    }
    if (error instanceof CliIntegrationError) throw error;
    throw invalidConfig(configPath, error);
  }
}

async function requireManifest(configPath: string): Promise<IntegrationManifest> {
  const manifest = await readManifest(configPath, true);
  if (!manifest) throw new Error("unreachable");
  return manifest;
}

function parseManifest(input: unknown, configPath: string): IntegrationManifest {
  if (!isRecord(input)) throw invalidConfig(configPath, "not an object");
  const service = input.service;
  const skill = input.skill;
  if (
    input.schemaVersion !== 1
    || input.agent !== "codex"
    || typeof input.sourceRoot !== "string"
    || !path.isAbsolute(input.sourceRoot)
    || !Array.isArray(input.runner)
    || input.runner.length === 0
    || input.runner.some((part) => typeof part !== "string" || part.length === 0)
    || !isRecord(service)
    || !isHttpUrl(service.apiUrl)
    || !Array.isArray(service.start)
    || service.start.length === 0
    || service.start.some((part) => typeof part !== "string" || part.length === 0)
    || !isHttpUrl(service.webUrl)
    || !isRecord(skill)
    || skill.name !== "human2ai"
    || (skill.mode !== "copy" && skill.mode !== "link")
    || skill.target !== ".agents/skills/human2ai"
    || typeof skill.sourceDigest !== "string"
    || !/^sha256:[0-9a-f]{64}$/.test(skill.sourceDigest)
  ) {
    throw invalidConfig(configPath, "schema validation failed");
  }
  return input as unknown as IntegrationManifest;
}

async function writeManifest(
  configPath: string,
  manifest: IntegrationManifest,
): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  const temporaryPath = `${configPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporaryPath, configPath);
}

async function ensureIntegrationConfigIgnored(root: string): Promise<void> {
  const ignorePath = path.join(root, INTEGRATION_IGNORE);
  let current = "";
  try {
    current = await readFile(ignorePath, "utf8");
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  const patterns = current.split(/\r?\n/).map((line) => line.trim());
  if (patterns.includes("integration.json") || patterns.includes("/integration.json")) {
    return;
  }
  const prefix = current.length === 0 || current.endsWith("\n") ? current : `${current}\n`;
  await mkdir(path.dirname(ignorePath), { recursive: true });
  await writeFile(ignorePath, `${prefix}integration.json\n`, "utf8");
}

function invalidConfig(configPath: string, reason: unknown): CliIntegrationError {
  return new CliIntegrationError(
    "INTEGRATION_CONFIG_INVALID",
    `Invalid Human2AI integration config at ${configPath}: ${errorMessage(reason)}.`,
    { configPath },
  );
}

function assertSameSource(
  manifest: IntegrationManifest,
  sourceRoot: string,
): void {
  if (path.resolve(manifest.sourceRoot) !== path.resolve(sourceRoot)) {
    throw new CliIntegrationError(
      "INTEGRATION_SOURCE_MISMATCH",
      "This consumer project is managed by a different local Human2AI source.",
      { installedSourceRoot: manifest.sourceRoot, currentSourceRoot: sourceRoot },
    );
  }
}

function assertManifestRunners(
  manifest: IntegrationManifest,
  sourceRoot: string,
): void {
  const expectedRunner = localRunner(sourceRoot);
  const expectedServiceStart = localServiceRunner(sourceRoot);
  if (
    !arraysEqual(manifest.runner, expectedRunner)
    || !arraysEqual(manifest.service.start, expectedServiceStart)
  ) {
    throw new CliIntegrationError(
      "INTEGRATION_CONFIG_INVALID",
      "Human2AI integration runner does not match the recorded local source.",
      {
        configuredRunner: manifest.runner,
        expectedRunner,
        configuredServiceStart: manifest.service.start,
        expectedServiceStart,
      },
    );
  }
}

function withSourceDigest(
  manifest: IntegrationManifest,
  sourceDigest: string,
): IntegrationManifest {
  return {
    ...manifest,
    skill: { ...manifest.skill, sourceDigest },
  };
}

function integrationResult(
  kind: "integration-install" | "integration-sync",
  status: string,
  root: string,
  manifest: IntegrationManifest,
  changed: boolean,
  sourceDigest: string,
): Record<string, unknown> {
  return {
    version: 1,
    kind,
    status,
    changed,
    root,
    configPath: path.join(root, INTEGRATION_CONFIG),
    ignorePath: path.join(root, INTEGRATION_IGNORE),
    sourceRoot: manifest.sourceRoot,
    runner: manifest.runner,
    service: manifest.service,
    skill: {
      ...manifest.skill,
      targetPath: path.join(root, manifest.skill.target),
      currentSourceDigest: sourceDigest,
    },
  };
}

function skillSourcePath(sourceRoot: string): string {
  return path.join(sourceRoot, "skills", "human2ai");
}

function localRunner(sourceRoot: string): string[] {
  const compiledCli = path.join(sourceRoot, "dist", "cli", "main.js");
  if (existsSync(compiledCli)) return ["node", compiledCli];
  throw new CliIntegrationError(
    "INTEGRATION_SOURCE_INVALID",
    `Built Human2AI CLI is missing under ${sourceRoot}. Run npm run build first.`,
    { sourceRoot },
  );
}

function localServiceRunner(sourceRoot: string): string[] {
  if (isDevelopmentSource(sourceRoot)) return ["npm", "--prefix", sourceRoot, "run", "dev"];
  return [...localRunner(sourceRoot), "web"];
}

function parseMode(mode: string): IntegrationMode {
  if (mode === "copy" || mode === "link") return mode;
  throw new CliIntegrationError(
    "INVALID_INTEGRATION_MODE",
    `Unsupported integration mode: ${mode}.`,
    { supportedModes: ["copy", "link"] },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function pathExists(filename: string): Promise<boolean> {
  return lstat(filename).then(() => true, (error: unknown) => {
    if (isNotFound(error)) return false;
    throw error;
  });
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
