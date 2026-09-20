import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const projectDirectory = resolve(".");
const gateTests = [
  "test/unit/domain-baseline.test.ts",
  "test/unit/shared-capability-boundaries.test.ts",
];

function fixtureRegistry() {
  return {
    schemaVersion: 1,
    categories: [{ id: "example", description: "Example responsibility" }],
    capabilities: [{
      id: "example.validation",
      category: "example",
      contractVersion: 1,
      status: "shared",
      responsibility: "Validate the same input for two consumers",
      invariants: ["Reject invalid input"],
      implementations: [
        { role: "canonical", path: "src/validation.ts" },
        { role: "canonical", path: "src/routes.ts" },
        { role: "adapter", path: "src/adapter.ts", consumer: "first" },
      ],
      consumers: ["first", "second"],
      variationPoints: [],
      contractTests: ["test/validation.test.ts"],
      reviewEvidence: [] as string[],
      exceptions: [] as Array<{ consumer: string; reason: string; reviewTrigger: string }>,
      reviewTrigger: "Before changing input validation",
    }],
  };
}

describe("domain baseline gate", () => {
  let directory: string;
  let registry: ReturnType<typeof fixtureRegistry>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "human2ai-domain-baseline-"));
    registry = fixtureRegistry();
    await mkdir(join(directory, "scripts"), { recursive: true });
    await mkdir(join(directory, "governance/domain-baseline"), { recursive: true });
    await copyFile(
      join(projectDirectory, "scripts/domain-baseline.mjs"),
      join(directory, "scripts/domain-baseline.mjs"),
    );
    await copyFile(
      join(projectDirectory, "governance/domain-baseline/schema.json"),
      join(directory, "governance/domain-baseline/schema.json"),
    );
    await writeFile(join(directory, "governance/baselines.json"), JSON.stringify({
      schemaVersion: 1,
      baselines: [{ id: "domain", location: "governance/domain-baseline", skill: "domain-baseline", check: "check" }],
    }));
    await symlink(join(projectDirectory, "node_modules"), join(directory, "node_modules"), "dir");
    for (const filename of [
      "src/validation.ts", "src/routes.ts", "src/adapter.ts", "README.md", "example.stories.tsx",
      "test/validation.test.ts", "test/additional.test.ts", "test/local.test.ts", ...gateTests,
    ]) {
      await mkdir(dirname(join(directory, filename)), { recursive: true });
      await writeFile(join(directory, filename), filename.endsWith(".test.ts")
        ? 'import { it } from "vitest"; it("fixture", () => {});\n'
        : "");
    }
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function run(...args: string[]) {
    await writeFile(join(directory, "governance/domain-baseline/registry.json"), JSON.stringify(registry));
    const stdout = await open(join(directory, "stdout"), "w");
    const stderr = await open(join(directory, "stderr"), "w");
    try {
      const code = await new Promise<number>((done, reject) => {
        const child = spawn(process.execPath, [join(directory, "scripts/domain-baseline.mjs"), ...args], {
          cwd: directory, stdio: ["ignore", stdout.fd, stderr.fd],
        });
        child.on("error", reject);
        child.on("close", (status) => done(status ?? 1));
      });
      return {
        code,
        stdout: await readFile(join(directory, "stdout"), "utf8"),
        stderr: await readFile(join(directory, "stderr"), "utf8"),
      };
    } finally {
      await stdout.close();
      await stderr.close();
    }
  }

  it("accepts canonical implementations across layers and explicit independent exceptions", async () => {
    expect((await run("check")).code).toBe(0);
    registry.capabilities[0].implementations[2].role = "current";
    registry.capabilities[0].exceptions.push({
      consumer: "first", reason: "Migration still uses the old validator", reviewTrigger: "When migration ends",
    });
    expect((await run("check")).code).toBe(0);
  });

  it.each(["README.md", "example.stories.tsx"])("rejects %s as an executable contract test", async (filename) => {
    registry.capabilities[0].contractTests = [filename];
    const result = await run("check");
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("contract test must match");
  });

  it("requires adapters to identify their consumer", async () => {
    registry.capabilities[0].implementations[2].consumer = undefined;
    expect((await run("check")).code).not.toBe(0);
  });

  it("accepts manual evidence separately and rejects missing evidence", async () => {
    registry.capabilities[0].reviewEvidence = ["README.md", "example.stories.tsx"];
    expect((await run("check")).code).toBe(0);
    registry.capabilities[0].reviewEvidence = ["missing.stories.tsx"];
    expect((await run("check")).code).not.toBe(0);
  });

  it("requires an exception for an independent implementation of a shared capability", async () => {
    registry.capabilities[0].implementations[2].role = "current";
    const result = await run("check");
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("requires a consumer and an exception");
  });

  it("rejects shared capabilities without a canonical implementation", async () => {
    registry.capabilities[0].implementations = registry.capabilities[0].implementations.slice(2);
    expect((await run("check")).code).not.toBe(0);
  });

  it("rejects missing test files and an empty capability registry", async () => {
    registry.capabilities[0].contractTests = ["test/missing.test.ts"];
    expect((await run("check")).code).not.toBe(0);
    registry.capabilities = [];
    expect((await run("check")).code).not.toBe(0);
  });

  it("selects and deduplicates new shared contracts while keeping local contracts out of the gate", async () => {
    const additional = structuredClone(registry.capabilities[0]);
    additional.id = "example.additional";
    additional.contractTests.push("test/additional.test.ts");
    const local = structuredClone(registry.capabilities[0]);
    local.id = "example.local";
    local.status = "local";
    local.contractTests = ["test/local.test.ts"];
    registry.capabilities.unshift(additional, local);
    const result = await run("tests");
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      "test/additional.test.ts", ...gateTests, "test/validation.test.ts",
    ]);
  });

  it.each([
    { body: 'import { it } from "vitest"; it("contract failure", () => { throw new Error("contract broke"); });\n', error: "contract broke" },
    { body: "", error: "No test suite found" },
  ])("fails the gate when a selected contract reports $error", async ({ body, error }) => {
    await writeFile(join(directory, "test/validation.test.ts"), body);
    const result = await run("test");
    expect(result.code).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(error);
  });
});
