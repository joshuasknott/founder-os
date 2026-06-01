"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useState } from "react";

const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full rounded-none border-0 bg-transparent p-0 shadow-none",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-black/[0.08] bg-white text-sm font-semibold text-text-primary shadow-sm hover:bg-surface",
    formButtonPrimary:
      "h-11 rounded-xl bg-accent text-xs font-bold text-white shadow-sm hover:bg-accent-hover",
    formFieldInput:
      "h-11 rounded-xl border border-black/[0.05] bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5",
    formFieldLabel: "text-xs font-semibold text-text-secondary",
    dividerLine: "bg-black/[0.06]",
    dividerText: "text-[10px] font-bold uppercase tracking-widest text-text-muted",
    footer: "hidden",
    formFieldAction: "text-xs font-semibold text-text-secondary hover:text-text-primary",
    identityPreviewEditButton: "text-xs font-semibold text-text-secondary hover:text-text-primary",
  },
};

export function LoginCard() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  return (
    <div className="flex w-full max-w-[400px] select-none flex-col items-center justify-center rounded-2xl border border-black/[0.04] bg-white/75 p-8 shadow-[0_10px_35px_rgba(0,0,0,0.03)] backdrop-blur-xl animate-slide-up">
      <div className="mb-6 w-full text-center">
        <h2 className="text-lg font-bold tracking-tight text-text-primary antialiased">
          FounderOS
        </h2>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {mode === "signUp" ? "Create your workspace" : "AI business workspace"}
        </p>
      </div>

      {mode === "signUp" ? (
        <SignUp
          routing="hash"
          fallbackRedirectUrl="/"
          signInUrl="/"
          appearance={clerkAppearance}
          oauthFlow="redirect"
        />
      ) : (
        <SignIn
          routing="hash"
          fallbackRedirectUrl="/"
          signUpUrl="/"
          appearance={clerkAppearance}
          oauthFlow="redirect"
          withSignUp
        />
      )}

      <button
        type="button"
        onClick={() => setMode((current) => (current === "signIn" ? "signUp" : "signIn"))}
        className="mt-4 w-full text-center text-xs font-semibold text-text-secondary hover:text-text-primary"
      >
        {mode === "signUp"
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </div>
  );
}
