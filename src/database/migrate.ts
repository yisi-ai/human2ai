import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

type DatabaseConnection = InstanceType<typeof Database>;

const migrationFilePattern = /^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/;

export function openDatabase(
  databasePath: string,
  migrationsDirectory: string,
): DatabaseConnection {
  const database = new Database(databasePath);

  try {
    database.pragma("foreign_keys = ON");
    database.pragma("synchronous = FULL");
    database.pragma("busy_timeout = 5000");
    applyMigrations(database, migrationsDirectory);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function applyMigrations(
  database: DatabaseConnection,
  migrationsDirectory: string,
): string[] {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT
  `);

  const applied = new Set(
    database
      .prepare<[], { name: string }>("SELECT name FROM schema_migrations")
      .all()
      .map(({ name }) => name),
  );
  const pending = readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .filter((name) => !applied.has(name));
  const insertMigration = database.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
  );

  for (const name of pending) {
    const sql = readFileSync(join(migrationsDirectory, name), "utf8");
    database.transaction(() => {
      database.exec(sql);
      insertMigration.run(name, new Date().toISOString());
    })();
  }

  return pending;
}
