"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useState } from "react";

const clerkAppearance = {
  variables: {
    borderRadius: "0.5rem",
    colorBackground: "#ffffff",
    colorDanger: "#b91c1c",
    colorInputBackground: "#ffffff",
    colorInputText: "#18181b",
    colorPrimary: "#171717",
    colorText: "#18181b",
    colorTextSecondary: "#52525b",
    fontFamily: "Inter, Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "w-full overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.08)]",
    card: "w-full rounded-none border-0 bg-white px-7 py-7 shadow-none sm:px-8",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    main: "gap-5",
    socialButtonsBlockButton:
      "h-11 rounded-md border border-black/[0.08] bg-white text-sm font-semibold text-text-primary shadow-none hover:bg-surface",
    socialButtonsBlockButtonText: "text-sm font-semibold text-text-secondary",
    formButtonPrimary:
      "h-11 rounded-md bg-accent text-sm font-semibold text-white shadow-none hover:bg-accent-hover",
    formFieldInput:
      "h-11 rounded-md border border-black/[0.10] bg-white px-3.5 py-2.5 text-sm text-text-primary shadow-none outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5",
    formFieldLabel: "text-xs font-semibold text-text-primary",
    formFieldInputShowPasswordButton: "text-text-muted hover:text-text-primary",
    formFieldSuccessText: "text-xs text-success",
    formFieldErrorText: "text-xs text-error",
    alert: "rounded-md border border-error/15 bg-error/5 text-sm text-error",
    dividerLine: "bg-black/[0.06]",
    dividerText: "text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted",
    footer: "bg-surface px-7 py-4 sm:px-8",
    footerActionText: "text-xs font-medium text-text-muted",
    footerActionLink: "text-xs font-semibold text-text-primary hover:text-accent-hover",
    footerPagesLink: "text-xs font-medium text-text-muted hover:text-text-primary",
    footerPages: "bg-surface",
    logoBox: "hidden",
    formFieldAction: "text-xs font-semibold text-text-secondary hover:text-text-primary",
    identityPreviewEditButton: "text-xs font-semibold text-text-secondary hover:text-text-primary",
    identityPreview: "rounded-md border border-black/[0.08] bg-surface",
    formResendCodeLink: "text-xs font-semibold text-text-primary hover:text-accent-hover",
    otpCodeFieldInput:
      "rounded-md border border-black/[0.10] text-text-primary focus:border-accent/40 focus:ring-4 focus:ring-accent/5",
  },
};

export function LoginCard({ fallbackRedirectUrl = "/" }: { fallbackRedirectUrl?: string }) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  return (
    <div className="flex w-full max-w-[420px] select-none flex-col items-center justify-center px-4 animate-slide-up">
      <div className="mb-5 w-full text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-black/[0.08] bg-white text-sm font-bold text-text-primary shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
          F
        </div>
        <h1 className="text-xl font-semibold tracking-normal text-text-primary antialiased">
          FounderOS
        </h1>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          {mode === "signUp" ? "Create your private workspace." : "Sign in to your private workspace."}
        </p>
      </div>

      {mode === "signUp" ? (
        <SignUp
          routing="hash"
          fallbackRedirectUrl={fallbackRedirectUrl}
          signInUrl="/"
          appearance={clerkAppearance}
          oauthFlow="redirect"
        />
      ) : (
        <SignIn
          routing="hash"
          fallbackRedirectUrl={fallbackRedirectUrl}
          signUpUrl="/"
          appearance={clerkAppearance}
          oauthFlow="redirect"
          withSignUp
        />
      )}

      <button
        type="button"
        onClick={() => setMode((current) => (current === "signIn" ? "signUp" : "signIn"))}
        className="mt-5 w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-text-secondary hover:bg-black/[0.03] hover:text-text-primary"
      >
        {mode === "signUp"
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </div>
  );
}
