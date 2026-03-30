import { BadRequestException, Body, Controller, Get, Param, Post, ServiceUnavailableException } from "@nestjs/common";
import { query } from "./db";
import { matchMarkdownToProblems, ProblemRow, stripExt } from "./notes-matcher";

type UploadNotesBody = {
  filename?: string;
  markdownContent?: string;
  markdown?: string;
};

type UserRow = {
  id: string;
};

type IdRow = {
  id: string;
};

type ProblemNoteRow = {
  problemSlug: string;
  problemTitle: string;
  sourceFilename: string;
  matchedHeading: string;
  contentMd: string;
  updatedAt: string;
};

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";
const MAX_MARKDOWN_SIZE = 3_000_000;
const NOTES_MIGRATION_HINT = "数据库尚未完成笔记表迁移，请执行：npm run db:migrate -w @leetcodepro/api";

function sanitizeFilename(filename: string): string {
  const normalized = filename.trim();
  const leaf = normalized.split(/[\\/]/).pop() ?? "notes.md";
  return leaf.slice(0, 128) || "notes.md";
}

function isMissingRelationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybePgError = error as { code?: unknown };
  return maybePgError.code === "42P01";
}

@Controller("notes")
export class NotesController {
  @Post("upload")
  async uploadMarkdownNotes(@Body() body: UploadNotesBody) {
    try {
      const rawFilename = body.filename?.trim() ?? "";
      const filename = sanitizeFilename(rawFilename);
      const markdownContent = (body.markdownContent ?? body.markdown ?? "").trim();

      if (!filename.toLowerCase().endsWith(".md")) {
        throw new BadRequestException("仅支持上传 .md 格式笔记。");
      }

      if (markdownContent.length === 0) {
        throw new BadRequestException("笔记内容不能为空。");
      }

      if (markdownContent.length > MAX_MARKDOWN_SIZE) {
        throw new BadRequestException(`笔记内容过大，请控制在 ${MAX_MARKDOWN_SIZE} 字符以内。`);
      }

      const userId = await this.getOrCreateDemoUserId();

      const noteResult = await query<IdRow>(
        `
          INSERT INTO user_notes(user_id, filename, markdown_content)
          VALUES($1, $2, $3)
          RETURNING id;
        `,
        [userId, filename, markdownContent]
      );

      const sourceNoteId = noteResult.rows[0]?.id;
      if (!sourceNoteId) {
        throw new BadRequestException("笔记保存失败，请稍后重试。");
      }

      const problemResult = await query<ProblemRow>(
        `
          SELECT id, leetcode_id AS "leetcodeId", slug, title
          FROM problems;
        `
      );

      const matched = matchMarkdownToProblems(markdownContent, stripExt(filename), problemResult.rows);

      for (const note of matched.matchedNotes) {
        await query(
          `
            INSERT INTO user_problem_notes(
              user_id,
              problem_id,
              source_note_id,
              source_filename,
              matched_heading,
              content_md
            )
            VALUES($1, $2, $3, $4, $5, $6)
            ON CONFLICT(user_id, problem_id)
            DO UPDATE SET
              source_note_id = EXCLUDED.source_note_id,
              source_filename = EXCLUDED.source_filename,
              matched_heading = EXCLUDED.matched_heading,
              content_md = EXCLUDED.content_md,
              updated_at = NOW();
          `,
          [userId, note.problem.id, sourceNoteId, filename, note.matchedHeading, note.contentMd]
        );
      }

      return {
        item: {
          noteId: sourceNoteId,
          filename,
          totalSections: matched.totalSections,
          matchedCount: matched.matchedNotes.length,
          unmatchedSectionCount: matched.unmatchedSectionCount,
          matches: matched.matchedNotes.map((entry) => ({
            problemSlug: entry.problem.slug,
            problemTitle: entry.problem.title,
            matchedHeading: entry.headingList.join(" | ")
          }))
        }
      };
    } catch (error) {
      if (isMissingRelationError(error)) {
        throw new ServiceUnavailableException(NOTES_MIGRATION_HINT);
      }
      throw error;
    }
  }

  @Get("problem/:problemSlug")
  async getProblemNote(@Param("problemSlug") problemSlug: string) {
    try {
      const userId = await this.getOrCreateDemoUserId();

      const result = await query<ProblemNoteRow>(
        `
          SELECT
            problems.slug AS "problemSlug",
            problems.title AS "problemTitle",
            user_problem_notes.source_filename AS "sourceFilename",
            user_problem_notes.matched_heading AS "matchedHeading",
            user_problem_notes.content_md AS "contentMd",
            user_problem_notes.updated_at::text AS "updatedAt"
          FROM user_problem_notes
          INNER JOIN problems ON problems.id = user_problem_notes.problem_id
          WHERE user_problem_notes.user_id = $1
            AND problems.slug = $2
          LIMIT 1;
        `,
        [userId, problemSlug]
      );

      return {
        item: result.rows[0] ?? null
      };
    } catch (error) {
      if (isMissingRelationError(error)) {
        throw new ServiceUnavailableException(NOTES_MIGRATION_HINT);
      }
      throw error;
    }
  }

  private async getOrCreateDemoUserId(): Promise<string> {
    const userResult = await query<UserRow>(
      `
        INSERT INTO users(email, password_hash, nickname)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
          SET updated_at = NOW()
        RETURNING id;
      `,
      [DEMO_USER_EMAIL, "demo-password-not-used", "Demo User"]
    );

    return userResult.rows[0].id;
  }
}
