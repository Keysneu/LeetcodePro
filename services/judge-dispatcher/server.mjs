import { createServer } from "node:http";
import amqp from "amqplib";
import pg from "pg";

import { judgeSubmissionWithCases } from "./src/judge-executor.mjs";
import { getSandboxExecutionMode } from "./src/sandbox-runner.mjs";

const { Pool } = pg;

const port = Number(process.env.JUDGE_PORT ?? 8080);
const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";
const queueName = process.env.JUDGE_QUEUE_NAME ?? "judge.submissions.v1";
const postgresUrl = process.env.POSTGRES_URL ?? "postgresql://postgres:postgres@localhost:5432/leetcodepro";

const pool = new Pool({
  connectionString: postgresUrl,
  max: 10
});

let ready = false;
let lastError = null;
let lastConsumedAt = null;
let reconnecting = false;
let shuttingDown = false;
let mqConnection = null;
let mqChannel = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function parseJob(content) {
  try {
    const parsed = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.submissionId === "string" &&
      parsed.submissionId.length > 0
    ) {
      return { submissionId: parsed.submissionId };
    }
  } catch {
    return null;
  }

  return null;
}

async function markSubmissionRuntimeError(submissionId, message) {
  await pool.query(
    `
      UPDATE submissions
      SET
        status = 'RE',
        runtime_ms = NULL,
        memory_kb = NULL,
        error_message = $2,
        updated_at = NOW()
      WHERE id = $1;
    `,
    [submissionId, message]
  );
}

async function processSubmission(submissionId) {
  const claimResult = await pool.query(
    `
      UPDATE submissions AS s
      SET
        status = 'RUNNING',
        updated_at = NOW()
      FROM problems AS p
      WHERE s.id = $1
        AND s.status = 'QUEUED'
        AND p.id = s.problem_id
      RETURNING
        s.id,
        s.problem_id AS "problemId",
        p.slug AS "problemSlug",
        s.language,
        s.mode,
        s.code;
    `,
    [submissionId]
  );

  const submission = claimResult.rows[0];
  if (!submission) {
    return;
  }

  const testCaseResult = await pool.query(
    `
      SELECT
        id,
        input_data AS "inputData",
        expected_output AS "expectedOutput"
      FROM test_cases
      WHERE problem_id = $1
      ORDER BY created_at ASC, id ASC;
    `,
    [submission.problemId]
  );

  const judged = await judgeSubmissionWithCases(submission, testCaseResult.rows);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM submission_case_results WHERE submission_id = $1;", [submission.id]);

    for (const caseResult of judged.caseResults) {
      await client.query(
        `
          INSERT INTO submission_case_results(
            submission_id,
            case_id,
            status,
            runtime_ms,
            memory_kb,
            stderr
          )
          VALUES($1, $2, $3, $4, $5, $6);
        `,
        [
          submission.id,
          caseResult.caseId,
          caseResult.status,
          caseResult.runtimeMs,
          caseResult.memoryKb,
          caseResult.stderr
        ]
      );
    }

    await client.query(
      `
        UPDATE submissions
        SET
          status = $2,
          runtime_ms = $3,
          memory_kb = $4,
          passed_count = $5,
          error_message = $6,
          updated_at = NOW()
        WHERE id = $1;
      `,
      [submission.id, judged.status, judged.runtimeMs, judged.memoryKb, judged.passedCount, judged.errorMessage]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function consumeMessage(message) {
  if (!mqChannel || !message) {
    return;
  }

  const payload = message.content.toString("utf8");
  const job = parseJob(payload);

  if (!job) {
    lastError = `Invalid queue message payload: ${payload}`;
    mqChannel.ack(message);
    return;
  }

  try {
    await processSubmission(job.submissionId);
    lastConsumedAt = new Date().toISOString();
    mqChannel.ack(message);
  } catch (error) {
    const messageText = toErrorMessage(error);
    lastError = `Process submission failed (${job.submissionId}): ${messageText}`;

    try {
      await markSubmissionRuntimeError(job.submissionId, `判题失败：${messageText}`);
    } catch (updateError) {
      const updateMessage = toErrorMessage(updateError);
      lastError = `${lastError}; update failed: ${updateMessage}`;
    }

    mqChannel.ack(message);
  }
}

async function connectConsumer() {
  mqConnection = await amqp.connect(rabbitmqUrl);
  mqChannel = await mqConnection.createChannel();

  mqConnection.on("error", (error) => {
    lastError = `RabbitMQ connection error: ${toErrorMessage(error)}`;
  });

  mqConnection.on("close", () => {
    ready = false;
    mqConnection = null;
    mqChannel = null;

    if (!shuttingDown) {
      void ensureConsumer();
    }
  });

  mqChannel.on("error", (error) => {
    lastError = `RabbitMQ channel error: ${toErrorMessage(error)}`;
  });

  await mqChannel.assertQueue(queueName, { durable: true });
  await mqChannel.prefetch(1);
  await mqChannel.consume(queueName, (message) => {
    void consumeMessage(message);
  });

  ready = true;
  lastError = null;
}

async function ensureConsumer() {
  if (reconnecting || shuttingDown) {
    return;
  }

  reconnecting = true;

  while (!ready && !shuttingDown) {
    try {
      await connectConsumer();
      break;
    } catch (error) {
      lastError = `Connect consumer failed: ${toErrorMessage(error)}`;
      await sleep(2000);
    }
  }

  reconnecting = false;
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  ready = false;

  if (mqChannel) {
    await mqChannel.close();
  }

  if (mqConnection) {
    await mqConnection.close();
  }

  await pool.end();
}

const server = createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (req.url === "/health") {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        service: "judge-dispatcher",
        status: ready ? "ok" : "degraded",
        executionMode: getSandboxExecutionMode(),
        queueName,
        lastConsumedAt,
        lastError
      })
    );
    return;
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Judge dispatcher ready on http://localhost:${port}/health`);
  void ensureConsumer();
});

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});
