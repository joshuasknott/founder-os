"use client";

import { useInsertionEffect } from "react";
import { installClerkAuthRefreshGuard } from "@/lib/clerk-auth-refresh-guard";

installClerkAuthRefreshGuard();

export function ClerkAuthRefreshGuard() {
  useInsertionEffect(() => {
    installClerkAuthRefreshGuard();
  }, []);

  return null;
}
