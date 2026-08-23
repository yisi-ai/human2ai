import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, openDatabase } from "../../src/database/migrate.js";

describe("applyMigrations", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("applies each migration once and records it", () => {
    const directory = createMigrationDirectory();
    writeFileSync(
      join(directory, "0001_example.sql"),
      "CREATE TABLE examples (id TEXT PRIMARY KEY) STRICT;\n",
    );
    const database = new Database(":memory:");

    expect(applyMigrations(database, directory)).toEqual(["0001_example.sql"]);
    expect(applyMigrations(database, directory)).toEqual([]);
    expect(
      database.prepare("SELECT name FROM schema_migrations ORDER BY name").all(),
    ).toEqual([{ name: "0001_example.sql" }]);

    database.close();
  });

  it("rolls back both schema and migration record when SQL fails", () => {
    const directory = createMigrationDirectory();
    writeFileSync(
      join(directory, "0001_broken.sql"),
      "CREATE TABLE should_rollback (id TEXT) STRICT;\nINVALID SQL;\n",
    );
    const database = new Database(":memory:");

    expect(() => applyMigrations(database, directory)).toThrow();
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = ?").get("should_rollback"),
    ).toBeUndefined();
    expect(database.prepare("SELECT name FROM schema_migrations").all()).toEqual([]);

    database.close();
  });

  it("opens SQLite with the required safety pragmas", () => {
    const directory = createMigrationDirectory();
    const database = openDatabase(":memory:", directory);

    expect(database.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(database.pragma("synchronous", { simple: true })).toBe(2);
    expect(database.pragma("busy_timeout", { simple: true })).toBe(5000);

    database.close();
  });

  function createMigrationDirectory(): string {
    const directory = mkdtempSync(join(tmpdir(), "human2ai-migrations-"));
    directories.push(directory);
    return directory;
  }
});
