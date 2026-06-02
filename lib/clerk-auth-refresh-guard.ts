const noop = () => undefined;

declare global {
  interface Window {
    __internal_onAfterSetActive?: () => void;
  }
}

export function installClerkAuthRefreshGuard() {
  if (typeof window === "undefined") return;

  try {
    Object.defineProperty(window, "__internal_onAfterSetActive", {
      configurable: true,
      get() {
        return noop;
      },
      set() {
        // Clerk's default app-router hook calls router.refresh() after token
        // changes. FounderOS keeps auth in the client shell, so ignore it.
      },
    });
  } catch {
    window.__internal_onAfterSetActive = noop;
  }
}
