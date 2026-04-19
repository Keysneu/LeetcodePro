import { query } from "./db";

type CountRow = {
  count: number;
};

const REQUIRED_ACM_COLUMNS = [
  "acm_input_spec",
  "acm_output_spec",
  "acm_sample_input",
  "acm_sample_output"
] as const;

let hasAcmColumnsPromise: Promise<boolean> | null = null;

export async function hasProblemAcmColumns(): Promise<boolean> {
  if (!hasAcmColumnsPromise) {
    hasAcmColumnsPromise = (async () => {
      const result = await query<CountRow>(
        `
          SELECT COUNT(*)::int AS count
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'problems'
            AND column_name = ANY($1::text[]);
        `,
        [REQUIRED_ACM_COLUMNS]
      );
      return result.rows[0]?.count === REQUIRED_ACM_COLUMNS.length;
    })();
  }

  return hasAcmColumnsPromise;
}

export async function getProblemAcmProjectionSql(prefix = ""): Promise<string> {
  const hasColumns = await hasProblemAcmColumns();
  if (hasColumns) {
    return `
      ${prefix}acm_input_spec AS "acmInputSpec",
      ${prefix}acm_output_spec AS "acmOutputSpec",
      ${prefix}acm_sample_input AS "acmSampleInput",
      ${prefix}acm_sample_output AS "acmSampleOutput"
    `;
  }

  return `
    ''::text AS "acmInputSpec",
    ''::text AS "acmOutputSpec",
    ''::text AS "acmSampleInput",
    ''::text AS "acmSampleOutput"
  `;
}
