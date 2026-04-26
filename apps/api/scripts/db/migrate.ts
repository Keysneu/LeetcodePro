import "../../src/load-project-env";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Pool } from "pg";

const DEFAULT_POSTGRES_URL = "postgresql://postgres:postgres@localhost:5432/leetcodepro";

const MIGRATIONS_DIR = path.resolve(__dirname, "sql/migrations");

type MigrationRow = {
  name: string;
};

async function readMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL ?? DEFAULT_POSTGRES_URL
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedResult = await client.query<MigrationRow>("SELECT name FROM schema_migrations;");
    const applied = new Set(appliedResult.rows.map((row) => row.name));
    const migrationFiles = await readMigrationFiles();

    for (const fileName of migrationFiles) {
      if (applied.has(fileName)) {
        // eslint-disable-next-line no-console
        console.log(`skip migration: ${fileName}`);
        continue;
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, fileName), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1);", [fileName]);
      // eslint-disable-next-line no-console
      console.log(`applied migration: ${fileName}`);
    }

    await client.query("COMMIT");
    // eslint-disable-next-line no-console
    console.log("database migration completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("database migration failed:", error);
  process.exitCode = 1;
});
