import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
  "skills/human2ai",
  "locales/en/common.json",
  "licenses",
  "assets/quaternius",
];

if (JSON.stringify(packageJson.files) !== JSON.stringify(expectedFiles)) {
  throw new Error("package.json files whitelist does not match the runtime package");
}
if (packageJson.private === true || packageJson.license !== "MIT") {
  throw new Error("Human2AI must be publishable with its MIT license");
}
if (
  packageJson.bin?.human2ai !== "./dist/cli/main.js" ||
  packageJson.bin?.h2a !== "./dist/cli/main.js"
) {
  throw new Error("Human2AI CLI bin entries are invalid");
}

const required = [
  "README.md",
  "README.en.md",
  "LICENSE",
  "licenses/YisiUI-LICENSE",
  "licenses/THIRD-PARTY-NOTICES.txt",
  "locales/en/common.json",
  "dist/cli/main.js",
  "dist/runtime-defaults.js",
  "dist/server/runtime.js",
  "web/out/index.html",
  "web/out/composition/index.html",
  "web/out/spatial/index.html",
  "web/out/ui-sketch/index.html",
  "web/out/styles/index.html",
  "web/out/_next/static",
  "migrations/0001_projects_and_sessions.sql",
  "migrations/0002_composition_versions_and_refinements.sql",
  "schemas/composition-draft.schema.json",
  "schemas/spatial-draft.schema.json",
  "dist/domain/spatial/assets/quaternius-superhero.json",
  "dist/domain/spatial/assets/quaternius-rig.json",
  "dist/domain/spatial/assets/quaternius-superhero-female.json",
  "dist/domain/spatial/assets/quaternius-female-rig.json",
  "assets/quaternius/License_Standard.txt",
  "schemas/spatial-operations.schema.json",
  "migrations/0008_spatial_spaces.sql",
  "schemas/composition-refinement-plan.schema.json",
  "skills/human2ai/SKILL.md",
  "skills/human2ai/agents/openai.yaml",
  "skills/human2ai/references/composition.md",
  "skills/human2ai/references/composition-projection.md",
  "skills/human2ai/references/ui-layout.md",
  "skills/human2ai/references/spatial.md",
];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const [packed] = JSON.parse(execFileSync(npm, ["pack", "--dry-run", "--ignore-scripts", "--json"], {
  cwd: projectDirectory,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  shell: process.platform === "win32",
}));
const packedPaths = new Set(packed.files.map((file) => file.path));
const missing = required.filter((file) => (
  !existsSync(join(projectDirectory, file))
  || !packedPaths.has(file) && !packed.files.some((entry) => entry.path.startsWith(`${file}/`))
));
if (missing.length > 0) {
  throw new Error(`Package is missing required files: ${missing.join(", ")}`);
}

const forbidden = packed.files.filter(({ path }) => (
  /^(docs|artifacts|output|\.human2ai-data|test|storybook|\.git|\.agents)\//.test(path)
  || /\.(sqlite|db)(?:-|$)|\.tgz$/.test(path)
  || /(^|\/)\.env(?:$|\.)/.test(path)
));
if (forbidden.length > 0) {
  throw new Error(`Package contains private or development files: ${forbidden.map((file) => file.path).join(", ")}`);
}
const config = JSON.parse(readFileSync(join(projectDirectory, ".yisiui/config.json"), "utf8"));
if (!readFileSync(join(projectDirectory, "licenses/YisiUI-LICENSE"))
  .equals(readFileSync(join(projectDirectory, config.vendorRoot, "LICENSE")))) {
  throw new Error("Packaged YisiUI license differs from the synchronized license");
}

process.stdout.write(
  `${JSON.stringify({ name: packageJson.name, version: packageJson.version, files: expectedFiles, size: packed.size, entryCount: packed.entryCount }, null, 2)}\n`,
);
