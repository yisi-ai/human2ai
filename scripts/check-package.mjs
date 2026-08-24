import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  readFileSync(join(projectDirectory, "package.json"), "utf8"),
);
const expectedFiles = [
  "dist",
  "web/out",
  "migrations",
  "schemas",
  "skills/human2ai-composition",
  "docs/构图Agent加工协议.md",
  "docs/本地项目接入.md",
];

if (JSON.stringify(packageJson.files) !== JSON.stringify(expectedFiles)) {
  throw new Error("package.json files whitelist does not match the runtime package");
}
if (packageJson.private !== true) {
  throw new Error("Human2AI must remain private for local-only distribution");
}
if (
  packageJson.bin?.human2ai !== "./dist/cli/main.js" ||
  packageJson.bin?.h2a !== "./dist/cli/main.js"
) {
  throw new Error("Human2AI CLI bin entries are invalid");
}

const required = [
  "dist/cli/main.js",
  "dist/server/runtime.js",
  "web/out/index.html",
  "web/out/composition/index.html",
  "web/out/_next/static",
  "migrations/0001_projects_and_sessions.sql",
  "migrations/0002_composition_versions_and_refinements.sql",
  "schemas/composition-draft.schema.json",
  "schemas/composition-refinement-plan.schema.json",
  "skills/human2ai-composition/SKILL.md",
  "docs/构图Agent加工协议.md",
  "docs/本地项目接入.md",
];
const missing = required.filter(
  (file) => !existsSync(join(projectDirectory, file)),
);
if (missing.length > 0) {
  throw new Error(`Package is missing required files: ${missing.join(", ")}`);
}

process.stdout.write(
  `${JSON.stringify({ name: packageJson.name, version: packageJson.version, files: expectedFiles }, null, 2)}\n`,
);
