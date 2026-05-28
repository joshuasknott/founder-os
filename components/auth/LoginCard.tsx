"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ShieldAlert, Loader2 } from "lucide-react";

export function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorStatus(null);

    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) throw error;
      
      // Basic reload to trigger BetterAuth state sync in ConvexProvider
      window.location.reload();
      
    } catch (err: any) {
      setErrorStatus(err.message || "Failed to authenticate.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center justify-center bg-white/75 border border-black/[0.04] p-8 max-w-[400px] shadow-[0_10px_35px_rgba(0,0,0,0.03)] rounded-2xl backdrop-blur-xl animate-slide-up select-none">
      <div className="mb-6 text-center w-full">
        <h2 className="text-lg font-bold tracking-tight text-text-primary antialiased">
          Sovereign Access
        </h2>
        <p className="text-[10px] font-bold tracking-widest text-text-muted uppercase mt-1">
          Identity Verification
        </p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-4 w-full">
        <div className="space-y-2 w-full">
          <input
            type="email"
            placeholder="founder@company.com"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            className="w-full border border-black/[0.05] px-4 py-2.5 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 text-sm h-11 rounded-xl shadow-sm text-text-primary bg-white focus:bg-white transition-all outline-none placeholder:text-text-muted/60"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2 w-full">
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            className="w-full border border-black/[0.05] px-4 py-2.5 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 text-sm h-11 rounded-xl shadow-sm text-text-primary bg-white focus:bg-white transition-all outline-none placeholder:text-text-muted/60"
            required
            disabled={isLoading}
          />
        </div>
        
        {errorStatus && (
          <div className="mt-2 p-3 bg-rose-50 border border-rose-500/10 rounded-xl text-[10px] font-semibold text-rose-600 leading-normal flex items-start gap-2 animate-fade-in">
            <ShieldAlert size={14} className="text-rose-500 shrink-0" />
            <p>ERROR: {errorStatus}</p>
          </div>
        )}
        
        <button 
          type="submit" 
          className="flex items-center justify-center w-full bg-accent hover:bg-accent-hover text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] h-11 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5 justify-center">
              <Loader2 size={13} className="animate-spin" />
              Authenticating...
            </span>
          ) : (
            "Access Workspace"
          )}
        </button>
      </form>
    </div>
  );
}
