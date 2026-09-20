import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { executeCli } from "../../src/cli/main.js";

describe("consumer project integration CLI", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses development defaults for direct source CLI calls without a consumer config", async () => {
    const consumerRoot = await mkdtemp(path.join(os.tmpdir(), "human2ai-source-cli-"));
    vi.stubEnv("HUMAN2AI_SERVER_URL", undefined);
    vi.stubEnv("HUMAN2AI_WEB_URL", undefined);
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      service: "human2ai",
      status: "ok",
      capabilities: [],
    }));
    try {
      expect(await executeCli(["service", "status"], {
        cwd: consumerRoot,
        integrationSourceRoot: path.resolve("."),
        fetch: fetcher,
      })).toMatchObject({
        status: "ready",
        apiUrl: "http://127.0.0.1:4180",
        webUrl: "http://localhost:3000",
      });
      expect(String(fetcher.mock.calls[0]?.[0])).toBe("http://127.0.0.1:4180/api/v1/health");
    } finally {
      await rm(consumerRoot, { recursive: true, force: true });
    }
  });

  it("connects source checkouts to the development service and starts npm run dev", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-integration-dev-"));
    const sourceRoot = path.join(directory, "source");
    const consumerRoot = path.join(directory, "consumer");
    try {
      await mkdir(path.join(sourceRoot, "skills", "human2ai"), { recursive: true });
      await mkdir(path.join(sourceRoot, "dist", "cli"), { recursive: true });
      await mkdir(path.join(sourceRoot, "scripts"), { recursive: true });
      await mkdir(consumerRoot);
      await writeFile(path.join(sourceRoot, "skills", "human2ai", "SKILL.md"), skillText("dev"));
      await writeFile(path.join(sourceRoot, "dist", "cli", "main.js"), "");
      await writeFile(path.join(sourceRoot, "scripts", "dev.mjs"), "");

      const installed = await executeCli(
        ["integration", "install", "--root", consumerRoot],
        { integrationSourceRoot: sourceRoot },
      );
      expect(installed).toMatchObject({
        status: "installed",
        runner: ["node", path.join(sourceRoot, "dist", "cli", "main.js")],
        service: {
          apiUrl: "http://127.0.0.1:4180",
          webUrl: "http://localhost:3000",
          start: ["npm", "--prefix", sourceRoot, "run", "dev"],
        },
      });
      expect(await executeCli(
        ["integration", "doctor", "--root", consumerRoot],
        { integrationSourceRoot: sourceRoot },
      )).toMatchObject({ status: "ready" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("distributes approximate lighting interpretation and user precedence to new consumer projects", async () => {
    const consumerRoot = await mkdtemp(path.join(os.tmpdir(), "human2ai-light-band-consumer-"));
    try {
      const installed = await executeCli(
        ["integration", "install", "--root", consumerRoot, "--mode", "copy"],
        { integrationSourceRoot: path.resolve(".") },
      );
      expect(installed).toMatchObject({ status: "installed" });
      const target = path.join(consumerRoot, ".agents", "skills", "human2ai");
      const entry = await readFile(path.join(target, "SKILL.md"), "utf8");
      const guide = await readFile(path.join(target, "references", "composition.md"), "utf8");
      expect(entry).toContain("Interpret light markers as approximately as ordinary shape regions");
      expect(guide).toContain("User instructions and node notes take precedence");
      expect(guide).toContain("Approximate overall correspondence is sufficient");
      expect(guide).toContain("narrower or wider");
      expect(guide).not.toContain("A result with a missing band fails the authored requirement");
      expect(guide).toBe(await readFile("skills/human2ai/references/composition.md", "utf8"));
    } finally {
      await rm(consumerRoot, { recursive: true, force: true });
    }
  });

  it("installs, checks, and synchronizes a copied Skill without overwriting consumer edits", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-integration-copy-"));
    const sourceRoot = path.join(directory, "human2ai-source");
    const consumerRoot = path.join(directory, "consumer");
    const sourceSkill = path.join(sourceRoot, "skills", "human2ai");
    const targetSkill = path.join(consumerRoot, ".agents", "skills", "human2ai");
    const sourceSkillFile = path.join(sourceSkill, "SKILL.md");
    const targetSkillFile = path.join(targetSkill, "SKILL.md");

    try {
      await mkdir(sourceSkill, { recursive: true });
      await mkdir(path.join(sourceRoot, "dist", "cli"), { recursive: true });
      await mkdir(path.join(consumerRoot, "nested"), { recursive: true });
      await writeFile(sourceSkillFile, skillText("first"), "utf8");
      await writeFile(path.join(sourceRoot, "dist", "cli", "main.js"), "", "utf8");

      const installed = await executeCli(
        [
          "--api-url", "http://human2ai-api.test",
          "--web-url", "http://human2ai-web.test",
          "integration", "install",
          "--agent", "codex",
          "--root", consumerRoot,
          "--mode", "copy",
        ],
        { integrationSourceRoot: sourceRoot },
      );
      expect(installed).toMatchObject({
        kind: "integration-install",
        status: "installed",
        changed: true,
        sourceRoot,
        service: {
          apiUrl: "http://human2ai-api.test",
          start: ["node", path.join(sourceRoot, "dist", "cli", "main.js"), "web"],
          webUrl: "http://human2ai-web.test",
        },
        skill: { mode: "copy", targetPath: targetSkill },
      });
      expect(await readFile(targetSkillFile, "utf8")).toBe(skillText("first"));

      const manifest = JSON.parse(
        await readFile(path.join(consumerRoot, ".human2ai", "integration.json"), "utf8"),
      );
      expect(
        await readFile(path.join(consumerRoot, ".human2ai", ".gitignore"), "utf8"),
      ).toBe("integration.json\n");
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        agent: "codex",
        sourceRoot,
        runner: ["node", path.join(sourceRoot, "dist", "cli", "main.js")],
        service: {
          start: ["node", path.join(sourceRoot, "dist", "cli", "main.js"), "web"],
        },
        skill: {
          name: "human2ai",
          mode: "copy",
          target: ".agents/skills/human2ai",
          sourceDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        },
      });

      const repeated = await executeCli(
        ["integration", "install", "--root", consumerRoot, "--mode", "copy"],
        { integrationSourceRoot: sourceRoot },
      );
      expect(repeated).toMatchObject({
        status: "already-installed",
        changed: false,
      });

      const calledUrls: string[] = [];
      const status = await executeCli(
        ["service", "status"],
        {
          cwd: path.join(consumerRoot, "nested"),
          fetch: (async (input: string | URL | Request) => {
            calledUrls.push(String(input));
            return Response.json({
              service: "human2ai",
              status: "ok",
              capabilities: [],
            });
          }) as typeof fetch,
        },
      );
      expect(status).toMatchObject({
        apiUrl: "http://human2ai-api.test",
        webUrl: "http://human2ai-web.test",
      });
      expect(calledUrls).toEqual(["http://human2ai-api.test/api/v1/health"]);

      await writeFile(sourceSkillFile, skillText("second"), "utf8");
      const checked = await executeCli(
        ["integration", "sync", "--root", consumerRoot, "--check"],
        { integrationSourceRoot: sourceRoot },
      );
      expect(checked).toMatchObject({
        kind: "integration-sync",
        status: "update-available",
        changed: false,
      });
      expect(await readFile(targetSkillFile, "utf8")).toBe(skillText("first"));

      const synced = await executeCli(
        ["integration", "sync", "--root", consumerRoot],
        { integrationSourceRoot: sourceRoot },
      );
      expect(synced).toMatchObject({ status: "updated", changed: true });
      expect(await readFile(targetSkillFile, "utf8")).toBe(skillText("second"));

      const doctor = await executeCli(
        ["integration", "doctor", "--root", consumerRoot],
        { integrationSourceRoot: sourceRoot },
      );
      expect(doctor).toMatchObject({
        kind: "integration-doctor",
        status: "ready",
        skill: { updateAvailable: false },
      });

      await writeFile(targetSkillFile, skillText("consumer edit"), "utf8");
      await writeFile(sourceSkillFile, skillText("third"), "utf8");
      await expect(
        executeCli(
          ["integration", "sync", "--root", consumerRoot],
          { integrationSourceRoot: sourceRoot },
        ),
      ).rejects.toMatchObject({ code: "INTEGRATION_CONFLICT" });
      expect(await readFile(targetSkillFile, "utf8")).toBe(skillText("consumer edit"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("installs a linked Skill that follows local source changes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-integration-link-"));
    const sourceRoot = path.join(directory, "human2ai-source");
    const consumerRoot = path.join(directory, "consumer");
    const sourceSkill = path.join(sourceRoot, "skills", "human2ai");
    const sourceSkillFile = path.join(sourceSkill, "SKILL.md");
    const targetSkill = path.join(consumerRoot, ".agents", "skills", "human2ai");

    try {
      await mkdir(sourceSkill, { recursive: true });
      await mkdir(path.join(sourceRoot, "dist", "cli"), { recursive: true });
      await mkdir(consumerRoot, { recursive: true });
      await writeFile(sourceSkillFile, skillText("linked first"), "utf8");
      await writeFile(path.join(sourceRoot, "dist", "cli", "main.js"), "", "utf8");

      const installed = await executeCli(
        ["integration", "install", "--root", consumerRoot, "--mode", "link"],
        { integrationSourceRoot: sourceRoot },
      );
      expect(installed).toMatchObject({
        status: "installed",
        runner: ["node", path.join(sourceRoot, "dist", "cli", "main.js")],
        service: {
          apiUrl: "http://127.0.0.1:4179",
          webUrl: "http://127.0.0.1:4179",
          start: ["node", path.join(sourceRoot, "dist", "cli", "main.js"), "web"],
        },
        skill: { mode: "link" },
      });
      expect((await lstat(targetSkill)).isSymbolicLink()).toBe(true);
      expect(path.resolve(path.dirname(targetSkill), await readlink(targetSkill))).toBe(sourceSkill);

      await writeFile(sourceSkillFile, skillText("linked second"), "utf8");
      expect(await readFile(path.join(targetSkill, "SKILL.md"), "utf8")).toBe(
        skillText("linked second"),
      );

      const checked = await executeCli(
        ["integration", "sync", "--root", consumerRoot, "--check"],
        { integrationSourceRoot: sourceRoot },
      );
      expect(checked).toMatchObject({ status: "current", changed: false });

      const synced = await executeCli(
        ["integration", "sync", "--root", consumerRoot],
        { integrationSourceRoot: sourceRoot },
      );
      expect(synced).toMatchObject({ status: "metadata-updated", changed: true });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses to replace an unmanaged Skill", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-integration-unmanaged-"));
    const sourceRoot = path.join(directory, "human2ai-source");
    const consumerRoot = path.join(directory, "consumer");
    const sourceSkill = path.join(sourceRoot, "skills", "human2ai");
    const targetSkill = path.join(consumerRoot, ".agents", "skills", "human2ai");

    try {
      await mkdir(sourceSkill, { recursive: true });
      await mkdir(path.join(sourceRoot, "dist", "cli"), { recursive: true });
      await mkdir(targetSkill, { recursive: true });
      await writeFile(path.join(sourceSkill, "SKILL.md"), skillText("source"), "utf8");
      await writeFile(path.join(sourceRoot, "dist", "cli", "main.js"), "", "utf8");
      await writeFile(path.join(targetSkill, "SKILL.md"), skillText("unmanaged"), "utf8");

      await expect(
        executeCli(
          ["integration", "install", "--root", consumerRoot],
          { integrationSourceRoot: sourceRoot },
        ),
      ).rejects.toMatchObject({ code: "INTEGRATION_CONFLICT" });
      expect(await readFile(path.join(targetSkill, "SKILL.md"), "utf8")).toBe(
        skillText("unmanaged"),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function skillText(marker: string): string {
  return `---\nname: human2ai\ndescription: ${marker}\n---\n`;
}
