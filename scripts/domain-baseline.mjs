import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv2020 } from "ajv/dist/2020.js";

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const governanceDirectory = join(projectDirectory, "governance");
const manifest = readJson(join(governanceDirectory, "baselines.json"));
const manifestErrors = validateManifest(manifest);
if (manifestErrors.length > 0) {
  fail(
    `domain baseline check failed:\n${manifestErrors.map((error) => `- ${error}`).join("\n")}`,
  );
}
const domainEntry = Array.isArray(manifest.baselines)
  ? manifest.baselines.find((entry) => entry?.id === "domain")
  : undefined;
const baselineDirectory = resolveProjectPath(domainEntry.location);
const registry = readJson(join(baselineDirectory, "registry.json"));
const schema = readJson(join(baselineDirectory, "schema.json"));
const errors = validateRegistry(registry, schema);

if (errors.length > 0) {
  fail(`domain baseline check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

const [command = "check", ...args] = process.argv.slice(2);
const capabilities = registry.capabilities;

switch (command) {
  case "check":
    process.stdout.write(
      `domain baseline check passed: ${capabilities.length} capabilities in ${registry.categories.length} categories\n`,
    );
    break;
  case "tests":
  case "test": {
    if (args.length > 0) fail(`usage: domain-baseline.mjs ${command}`);
    const testFiles = [...new Set([
      "test/unit/domain-baseline.test.ts",
      "test/unit/shared-capability-boundaries.test.ts",
      ...capabilities
        .filter((capability) => capability.status === "shared")
        .flatMap((capability) => capability.contractTests),
    ])].sort();
    if (command === "tests") {
      writeJson(testFiles);
      break;
    }
    const child = spawn(process.execPath, [
      join(projectDirectory, "node_modules/vitest/vitest.mjs"), "run", ...testFiles,
    ], { cwd: projectDirectory, stdio: "inherit" });
    child.on("error", (error) => fail(error.message));
    child.on("exit", (code) => process.exit(code ?? 1));
    break;
  }
  case "categories":
    writeJson(registry.categories);
    break;
  case "list": {
    const category = optionValue(args, "--category");
    rejectUnexpectedArgs(args, category ? ["--category", category] : []);
    if (category && !registry.categories.some((entry) => entry.id === category)) {
      fail(`unknown domain baseline category: ${category}`);
    }
    writeJson(
      capabilities
        .filter((capability) => !category || capability.category === category)
        .map(summarizeCapability),
    );
    break;
  }
  case "get": {
    if (args.length !== 1) fail("usage: domain-baseline.mjs get <capability-id>");
    const capability = capabilities.find((entry) => entry.id === args[0]);
    if (!capability) fail(`unknown domain baseline capability: ${args[0]}`);
    writeJson(capability);
    break;
  }
  case "search": {
    if (args.length === 0) fail("usage: domain-baseline.mjs search <text>");
    const query = args.join(" ").toLocaleLowerCase();
    writeJson(
      capabilities
        .filter((capability) =>
          JSON.stringify(capability).toLocaleLowerCase().includes(query),
        )
        .map(summarizeCapability),
    );
    break;
  }
  default:
    fail(
      "usage: domain-baseline.mjs <check|tests|test|categories|list [--category <id>]|get <id>|search <text>>",
    );
}

function validateManifest(value) {
  const validationErrors = [];
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.baselines)) {
    return ["governance/baselines.json must contain schemaVersion 1 and baselines"];
  }

  const ids = new Set();
  for (const entry of value.baselines) {
    if (
      !isRecord(entry)
      || typeof entry.id !== "string"
      || typeof entry.location !== "string"
      || typeof entry.skill !== "string"
      || !(typeof entry.check === "string" || entry.check === null)
    ) {
      validationErrors.push("every governance baseline entry must have id, location, skill, and check");
      continue;
    }
    if (ids.has(entry.id)) validationErrors.push(`duplicate governance baseline id: ${entry.id}`);
    ids.add(entry.id);
    validatePath(entry.location, `baseline ${entry.id} location`, validationErrors, true);
  }
  if (!ids.has("domain")) validationErrors.push("governance baselines must include domain");
  return validationErrors;
}

function validateRegistry(value, registrySchema) {
  const validationErrors = [];
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(registrySchema);
  if (!validate(value)) {
    for (const error of validate.errors ?? []) {
      validationErrors.push(`registry ${error.instancePath || "/"} ${error.message}`);
    }
    return validationErrors;
  }

  const categoryIds = value.categories.map((category) => category.id);
  requireSortedUnique(categoryIds, "category ids", validationErrors);
  const capabilityIds = value.capabilities.map((capability) => capability.id);
  requireSortedUnique(capabilityIds, "capability ids", validationErrors);
  const categories = new Set(categoryIds);

  for (const capability of value.capabilities) {
    if (!categories.has(capability.category)) {
      validationErrors.push(`${capability.id} references unknown category ${capability.category}`);
    }
    if (!capability.id.startsWith(`${capability.category}.`)) {
      validationErrors.push(`${capability.id} must begin with ${capability.category}.`);
    }
    requireSortedUnique(capability.consumers, `${capability.id} consumers`, validationErrors);

    const implementationKeys = capability.implementations.map(
      (implementation) =>
        `${implementation.role}:${implementation.consumer ?? ""}:${implementation.path}`,
    );
    if (new Set(implementationKeys).size !== implementationKeys.length) {
      validationErrors.push(`${capability.id} contains duplicate implementation records`);
    }
    for (const implementation of capability.implementations) {
      validatePath(
        implementation.path,
        `${capability.id} implementation`,
        validationErrors,
        false,
      );
      if (implementation.consumer && !capability.consumers.includes(implementation.consumer)) {
        validationErrors.push(
          `${capability.id} implementation references unknown consumer ${implementation.consumer}`,
        );
      }
      if (implementation.role === "adapter" && !implementation.consumer) {
        validationErrors.push(`${capability.id} adapter must identify its consumer`);
      }
      if (
        capability.status === "shared"
        && implementation.role === "current"
        && (!implementation.consumer || !capability.exceptions.some(
          (exception) => exception.consumer === implementation.consumer,
        ))
      ) {
        validationErrors.push(`${capability.id} independent implementation requires a consumer and an exception`);
      }
    }
    for (const contractTest of capability.contractTests) {
      validatePath(contractTest, `${capability.id} contract test`, validationErrors, false);
      // Keep aligned with the executable test locations in vitest.config.ts.
      if (!/^(?:test|web)\/.+\.test\.ts$/.test(contractTest) || contractTest.includes("/../")) {
        validationErrors.push(`${capability.id} contract test must match test/**/*.test.ts or web/**/*.test.ts: ${contractTest}`);
      }
    }
    for (const evidence of capability.reviewEvidence ?? []) {
      validatePath(evidence, `${capability.id} review evidence`, validationErrors, false);
    }
    for (const exception of capability.exceptions) {
      if (!capability.consumers.includes(exception.consumer)) {
        validationErrors.push(
          `${capability.id} exception references unknown consumer ${exception.consumer}`,
        );
      }
    }
    if (capability.status === "shared") {
      if (!capability.implementations.some(({ role }) => role === "canonical")) {
        validationErrors.push(`${capability.id} is shared but has no canonical implementation`);
      }
      if (capability.contractTests.length === 0) {
        validationErrors.push(`${capability.id} is shared but has no contract tests`);
      }
    }
    if (capability.status === "candidate" && capability.consumers.length < 2) {
      validationErrors.push(`${capability.id} is a candidate but has fewer than two consumers`);
    }
  }
  return validationErrors;
}

function validatePath(pathname, label, errorList, expectDirectory) {
  if (isAbsolute(pathname)) {
    errorList.push(`${label} must be relative to the repository: ${pathname}`);
    return;
  }
  const resolvedPath = resolveProjectPath(pathname);
  const projectRelative = relative(projectDirectory, resolvedPath);
  if (projectRelative === ".." || projectRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    errorList.push(`${label} escapes the repository: ${pathname}`);
    return;
  }
  if (!existsSync(resolvedPath)) {
    errorList.push(`${label} does not exist: ${pathname}`);
    return;
  }
  if (expectDirectory !== statSync(resolvedPath).isDirectory()) {
    errorList.push(`${label} must reference a ${expectDirectory ? "directory" : "file"}: ${pathname}`);
  }
}

function requireSortedUnique(values, label, errorList) {
  if (new Set(values).size !== values.length) errorList.push(`${label} must be unique`);
  if (JSON.stringify(values) !== JSON.stringify([...values].sort())) {
    errorList.push(`${label} must be sorted`);
  }
}

function summarizeCapability(capability) {
  return {
    id: capability.id,
    category: capability.category,
    status: capability.status,
    contractVersion: capability.contractVersion,
    responsibility: capability.responsibility,
  };
}

function optionValue(args, option) {
  const index = args.indexOf(option);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value) fail(`${option} requires a value`);
  return value;
}

function rejectUnexpectedArgs(args, expected) {
  if (JSON.stringify(args) !== JSON.stringify(expected)) {
    fail("usage: domain-baseline.mjs list [--category <id>]");
  }
}

function resolveProjectPath(pathname) {
  return resolve(projectDirectory, pathname);
}

function readJson(filename) {
  return JSON.parse(readFileSync(filename, "utf8"));
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
