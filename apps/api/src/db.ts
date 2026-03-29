import { Pool, QueryResult, QueryResultRow } from "pg";

const DEFAULT_POSTGRES_URL = "postgresql://postgres:postgres@localhost:5432/leetcodepro";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ?? DEFAULT_POSTGRES_URL,
  max: 10
});

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, [...values]);
}

export async function closeDbPool(): Promise<void> {
  await pool.end();
}
