export type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";

export type SubmissionFailureCase = {
  status: SubmissionStatus;
  isHidden: boolean;
  inputData: string;
  actualOutput: string | null;
  expectedOutput: string;
  stderr: string | null;
};

export type ReplaySubmission = {
  id: string;
  problemSlug: string;
  language: "cpp" | "python";
  mode: "core" | "acm";
  code: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  failureCase?: SubmissionFailureCase | null;
};

export type ReplayAiMessage = {
  content: string;
  createdAt: string;
  sessionId: string;
  source: string | null;
  provider: string | null;
};

export type SubmissionSyncSnapshot = {
  id: string;
  problemSlug: string;
  language: "cpp" | "python";
  mode: "core" | "acm";
  code: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  failureCase?: SubmissionFailureCase | null;
};

export type SubmissionReplayResponse = {
  submission: ReplaySubmission;
  ai: {
    review: ReplayAiMessage | null;
    solution: ReplayAiMessage | null;
  };
};

export type SubmissionReplayEventDetail = {
  problemSlug: string;
  replay: SubmissionReplayResponse;
};

export type SubmissionSyncEventDetail = {
  problemSlug: string;
  submission: SubmissionSyncSnapshot;
};

export type EditorSyncEventDetail = {
  problemSlug: string;
  editor: {
    mode: "core" | "acm";
    language: "cpp" | "python";
  };
};

export const SUBMISSION_REPLAY_EVENT = "leetcodepro:submission-replay";
export const SUBMISSION_SYNC_EVENT = "leetcodepro:submission-sync";
export const EDITOR_SYNC_EVENT = "leetcodepro:editor-sync";

export function emitSubmissionReplay(detail: SubmissionReplayEventDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<SubmissionReplayEventDetail>(SUBMISSION_REPLAY_EVENT, { detail }));
}

export function emitSubmissionSync(detail: SubmissionSyncEventDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<SubmissionSyncEventDetail>(SUBMISSION_SYNC_EVENT, { detail }));
}

export function emitEditorSync(detail: EditorSyncEventDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<EditorSyncEventDetail>(EDITOR_SYNC_EVENT, { detail }));
}
