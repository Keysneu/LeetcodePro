export type CodeMode = "core" | "acm";
export type Language = "cpp" | "python";
export type ModeSupport = "CORE" | "ACM" | "BOTH";

export type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";

export interface Problem {
  id: string;
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  modeSupport: ModeSupport;
}

export interface Submission {
  id: string;
  problemSlug: string;
  language: Language;
  mode: CodeMode;
  code: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  failureCase?: {
    status: SubmissionStatus;
    isHidden: boolean;
    inputData: string;
    actualOutput: string | null;
    expectedOutput: string;
    stderr: string | null;
  } | null;
}
