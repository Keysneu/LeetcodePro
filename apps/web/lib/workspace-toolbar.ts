export type WorkspaceToolbarState = {
  problemSlug: string;
  submitLoading: boolean;
  runLoading: boolean;
  canRefresh: boolean;
};

export type WorkspaceToolbarRequestDetail = {
  problemSlug: string;
};

export const WORKSPACE_TOOLBAR_STATE_EVENT = "leetcodepro:workspace-toolbar-state";
export const WORKSPACE_SUBMIT_REQUEST_EVENT = "leetcodepro:workspace-submit-request";
export const WORKSPACE_RUN_TESTS_REQUEST_EVENT = "leetcodepro:workspace-run-tests-request";
export const WORKSPACE_REFRESH_REQUEST_EVENT = "leetcodepro:workspace-refresh-request";

export function emitWorkspaceToolbarState(detail: WorkspaceToolbarState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<WorkspaceToolbarState>(WORKSPACE_TOOLBAR_STATE_EVENT, { detail }));
}

export function emitWorkspaceSubmitRequest(detail: WorkspaceToolbarRequestDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<WorkspaceToolbarRequestDetail>(WORKSPACE_SUBMIT_REQUEST_EVENT, { detail }));
}

export function emitWorkspaceRunTestsRequest(detail: WorkspaceToolbarRequestDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<WorkspaceToolbarRequestDetail>(WORKSPACE_RUN_TESTS_REQUEST_EVENT, { detail }));
}

export function emitWorkspaceRefreshRequest(detail: WorkspaceToolbarRequestDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<WorkspaceToolbarRequestDetail>(WORKSPACE_REFRESH_REQUEST_EVENT, { detail }));
}
