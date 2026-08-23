#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const consumerRoot = process.cwd();
const command = process.argv[2];
const passthrough = process.argv.slice(3);
const usage = `Usage: npm run yisiui -- <command> [options]

Commands:
  list
  diff
  update
  sync
  doctor
  check
  query
  propose

The private source defaults to ../yisiui. Override it without changing this
repository by setting YISIUI_SOURCE_ROOT=/path/to/private/yisiui.
`;

if (!command || command === "help" || command === "--help") {
  process.stdout.write(usage);
  process.exit(0);
}

const supported = new Set(["list", "diff", "update", "sync", "doctor", "check", "query", "propose"]);
if (!supported.has(command)) {
  process.stderr.write(`Unsupported consumer command: ${command}\n\n${usage}`);
  process.exit(1);
}

const configPath = path.join(consumerRoot, ".yisiui/config.json");
if (!existsSync(configPath)) {
  process.stderr.write("Run this command from an initialized consumer project root.\n");
  process.exit(1);
}

const sourceRoot = path.resolve(
  consumerRoot,
  process.env.YISIUI_SOURCE_ROOT ?? path.join("..", "yisiui"),
);
const cliPath = path.join(sourceRoot, "packages/cli/dist/cli.js");
if (!existsSync(cliPath)) {
  process.stderr.write(
    `YisiUI CLI was not found at ${cliPath}.\n`
    + "Set YISIUI_SOURCE_ROOT or build the private YisiUI checkout first.\n",
  );
  process.exit(1);
}

const sourceCommands = new Set(["list", "diff", "update", "sync"]);
const cliArguments = command === "list"
  ? [cliPath, command, ...passthrough]
  : [cliPath, command, ".", ...passthrough];
if (sourceCommands.has(command)) cliArguments.push("--source", sourceRoot);

const result = spawnSync(process.execPath, cliArguments, {
  cwd: consumerRoot,
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
