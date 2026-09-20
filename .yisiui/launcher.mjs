#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const usage = `Usage: node .yisiui/launcher.mjs <command> [options]
Or use packageManager + commandScript from .yisiui/config.json.
Existing product yisiui:* scripts may serve a different UI system.

Commands:
  list
  diff
  update
  sync
  doctor
  check
  query
  propose
  proposal validate
  proposal submit
  proposal list

The private source is discovered from ../yisiui and then from yisiui
directories beside each ancestor of the consumer project. Override discovery
without changing this repository by setting
YISIUI_SOURCE_ROOT=/path/to/private/yisiui.
`;

function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function inspectSourceCandidate(sourceRootInput) {
  const sourceRoot = path.resolve(sourceRootInput);
  const packagePath = path.join(sourceRoot, "package.json");
  const cliPath = path.join(sourceRoot, "packages/cli/dist/cli.js");
  const problems = [];

  try {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    if (packageJson.name !== "yisiui") {
      problems.push(
        `package.json identifies ${JSON.stringify(packageJson.name ?? null)} instead of "yisiui"`,
      );
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    problems.push(code === "ENOENT"
      ? "package.json was not found"
      : `package.json could not be read (${error instanceof Error ? error.message : String(error)})`);
  }

  if (!isFile(cliPath)) {
    problems.push("packages/cli/dist/cli.js was not found as a file");
  }

  return { sourceRoot, cliPath, problems, valid: problems.length === 0 };
}

export function defaultSourceCandidates(consumerRootInput) {
  const consumerRoot = path.resolve(consumerRootInput);
  const candidates = [];
  const seen = new Set();
  let ancestor = path.dirname(consumerRoot);

  while (true) {
    const candidate = path.resolve(ancestor, "yisiui");
    if (!seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }

  return candidates;
}

function formatProblems(inspection) {
  return inspection.problems.map((problem) => `  - ${problem}`).join("\n");
}

export function resolveSourceRoot(consumerRootInput, environment = process.env) {
  const consumerRoot = path.resolve(consumerRootInput);
  const explicitSourceRoot = environment.YISIUI_SOURCE_ROOT;

  if (explicitSourceRoot !== undefined) {
    const inspection = inspectSourceCandidate(path.resolve(consumerRoot, explicitSourceRoot));
    if (!inspection.valid) {
      throw new Error(
        `YISIUI_SOURCE_ROOT is set to ${inspection.sourceRoot}, but it is not a valid YisiUI source checkout:\n`
        + `${formatProblems(inspection)}\n`
        + "The explicit path is authoritative; fix it or unset YISIUI_SOURCE_ROOT.",
      );
    }
    return inspection.sourceRoot;
  }

  const inspections = defaultSourceCandidates(consumerRoot).map(inspectSourceCandidate);
  const valid = inspections.filter((inspection) => inspection.valid);
  if (valid.length === 1) return valid[0].sourceRoot;

  if (valid.length > 1) {
    throw new Error(
      "Multiple valid YisiUI source checkouts were found:\n"
      + `${valid.map((inspection) => `  - ${inspection.sourceRoot}`).join("\n")}\n`
      + "Set YISIUI_SOURCE_ROOT to select one explicitly.",
    );
  }

  throw new Error(
    "No valid YisiUI source checkout was found.\n"
    + "Checked candidate paths:\n"
    + `${inspections.map((inspection) => (
      `- ${inspection.sourceRoot}\n${formatProblems(inspection)}`
    )).join("\n")}\n`
    + "Set YISIUI_SOURCE_ROOT to a built private YisiUI checkout.",
  );
}

export function assertSourceCompatibility(consumerRoot, sourceRoot) {
  const config = JSON.parse(readFileSync(path.join(consumerRoot, ".yisiui/config.json"), "utf8"));
  const sourcePackage = JSON.parse(readFileSync(path.join(sourceRoot, "packages/cli/package.json"), "utf8"));
  const release = JSON.parse(readFileSync(path.join(sourceRoot, `design-system/releases/web-react/${sourcePackage.version}-source-sync.json`), "utf8"));
  const required = config.skills?.integrationVersion ?? 1;
  if (!Number.isInteger(release.compatibility?.integrationVersion) || release.compatibility.integrationVersion < required) {
    throw new Error(`Source checkout integration version cannot consume this configuration (requires ${required}); use a current YisiUI checkout.`);
  }
  return config;
}

function main() {
  const consumerRoot = process.cwd();
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [command, ...passthrough] = args;

  if (!command || command === "help" || command === "--help") {
    process.stdout.write(usage);
    process.exit(0);
  }

  const supported = new Set(["list", "diff", "update", "sync", "doctor", "check", "query", "propose", "proposal"]);
  if (!supported.has(command)) {
    process.stderr.write(`Unsupported consumer command: ${command}\n\n${usage}`);
    process.exit(1);
  }

  const configPath = path.join(consumerRoot, ".yisiui/config.json");
  if (!existsSync(configPath)) {
    process.stderr.write("Run this command from an initialized consumer project root.\n");
    process.exit(1);
  }

  let sourceRoot;
  try {
    sourceRoot = resolveSourceRoot(consumerRoot);
    assertSourceCompatibility(consumerRoot, sourceRoot);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  const cliPath = path.join(sourceRoot, "packages/cli/dist/cli.js");
  const cliArguments = buildCliArguments(cliPath, sourceRoot, command, passthrough);

  const result = spawnSync(process.execPath, cliArguments, {
    cwd: consumerRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

export function buildCliArguments(cliPath, sourceRoot, command, passthrough) {
  if (command === "list") return [cliPath, command, ...passthrough, "--source", sourceRoot];
  if (command === "proposal") {
    const [action, ...proposalArguments] = passthrough;
    if (action !== "validate" && action !== "submit" && action !== "list") {
      throw new Error("Proposal command must be `proposal validate`, `proposal submit`, or `proposal list`.");
    }
    return [cliPath, command, action, ".", ...proposalArguments, "--source", sourceRoot];
  }
  const cliArguments = [cliPath, command, ".", ...passthrough];
  if (new Set(["diff", "update", "sync"]).has(command)) {
    cliArguments.push("--source", sourceRoot);
  }
  return cliArguments;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main();
}
