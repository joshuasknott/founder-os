"use client";

const ACCOUNT_DELETION_PENDING_KEY = "founderos:account-deletion-pending";
const ANY_READY_WORKSPACE_KEY = "founderos:workspace-ready:any";
const USER_READY_WORKSPACE_KEY_PREFIX = "founderos:workspace-ready:";

export const ACCOUNT_DELETION_PENDING_EVENT = "founderos:account-deletion-pending-changed";

function emitAccountDeletionPendingChanged() {
  window.dispatchEvent(new Event(ACCOUNT_DELETION_PENDING_EVENT));
}

export function readAccountDeletionPending() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ACCOUNT_DELETION_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAccountDeletionPending() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNT_DELETION_PENDING_KEY, "1");
  } catch {
    // The in-memory auth gate still receives the same-tab event below.
  }
  emitAccountDeletionPendingChanged();
}

export function clearAccountDeletionPending() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCOUNT_DELETION_PENDING_KEY);
  } catch {
    // Local storage can be unavailable in private or locked-down browsers.
  }
  emitAccountDeletionPendingChanged();
}

export function clearDeletedAccountReadyHints(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANY_READY_WORKSPACE_KEY);
    if (userId) {
      window.localStorage.removeItem(`${USER_READY_WORKSPACE_KEY_PREFIX}${userId}`);
      return;
    }

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(USER_READY_WORKSPACE_KEY_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Deletion still proceeds; stale hints only affect client-side smoothing.
  }
}
