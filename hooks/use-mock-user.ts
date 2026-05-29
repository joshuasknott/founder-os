import { useState, useEffect } from "react";

export interface MockUser {
  name: string;
  email: string;
  avatarUrl: string;
  businessName: string;
}

const DEFAULT_USER: MockUser = {
  name: "Josh Knott",
  email: "josh@founderos.co",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  businessName: "FounderOS",
};

const EVENT_NAME = "mock-user-changed";

export function useMockUser() {
  const [user, setUser] = useState<MockUser>(DEFAULT_USER);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      const saved = localStorage.getItem("founder-os-mock-user");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as MockUser;
          if (!parsed.businessName) {
            parsed.businessName = DEFAULT_USER.businessName;
          }
          setUser(parsed);
        } catch {
          // Fallback to default.
        }
      }
    });

    const handleUpdate = () => {
      const current = localStorage.getItem("founder-os-mock-user");
      if (current) {
        try {
          const parsed = JSON.parse(current) as MockUser;
          if (!parsed.businessName) {
            parsed.businessName = DEFAULT_USER.businessName;
          }
          setUser(parsed);
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
    };
  }, []);

  const updateUser = (updated: Partial<MockUser>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      localStorage.setItem("founder-os-mock-user", JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT_NAME));
      return next;
    });
  };

  return { user, updateUser, mounted };
}
