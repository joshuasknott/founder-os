"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Loader2, ShieldAlert } from "lucide-react";

export function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorStatus(null);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) throw error;

      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in.";
      setErrorStatus(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-[400px] select-none flex-col items-center justify-center rounded-2xl border border-black/[0.04] bg-white/75 p-8 shadow-[0_10px_35px_rgba(0,0,0,0.03)] backdrop-blur-xl animate-slide-up">
      <div className="mb-6 w-full text-center">
        <h2 className="text-lg font-bold tracking-tight text-text-primary antialiased">
          FounderOS
        </h2>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          AI business workspace
        </p>
      </div>

      <form onSubmit={handleLogin} className="w-full space-y-4">
        <input
          type="email"
          placeholder="founder@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/[0.05] bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm outline-none transition-all placeholder:text-text-muted/60 focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/5"
          required
          disabled={isLoading}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/[0.05] bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm outline-none transition-all placeholder:text-text-muted/60 focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/5"
          required
          disabled={isLoading}
        />

        {errorStatus && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-500/10 bg-rose-50 p-3 text-[10px] font-semibold leading-normal text-rose-600 animate-fade-in">
            <ShieldAlert size={14} className="shrink-0 text-rose-500" />
            <p>{errorStatus}</p>
          </div>
        )}

        <button
          type="submit"
          className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-accent text-xs font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 size={13} className="animate-spin" />
              Opening...
            </span>
          ) : (
            "Open Workspace"
          )}
        </button>
      </form>
    </div>
  );
}
