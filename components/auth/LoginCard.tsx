"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

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
    <div className="flex w-full flex-col items-center justify-center border border-zinc-200 bg-[#FFFFFF] p-8 max-w-[400px]">
      <div className="mb-6 text-center w-full">
        <h2 className="text-xl font-medium tracking-tight text-[#000000]">
          Sovereign Access
        </h2>
        <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase mt-2">
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
            className="w-full border border-zinc-300 px-3 py-2 focus:border-[#000000] focus:ring-[#000000] text-base h-12 rounded-none shadow-none text-black bg-white"
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
            className="w-full border border-zinc-300 px-3 py-2 focus:border-[#000000] focus:ring-[#000000] text-base h-12 rounded-none shadow-none text-black bg-white"
            required
            disabled={isLoading}
          />
        </div>
        
        {errorStatus && (
          <p className="text-xs font-mono text-red-600 font-medium pb-2">ERROR: {errorStatus}</p>
        )}
        
        <button 
          type="submit" 
          className="flex items-center justify-center w-full bg-[#000000] hover:bg-zinc-800 text-[#FFFFFF] shadow-none h-12 text-base font-medium rounded-none transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "Authenticating..." : "Access OS"}
        </button>
      </form>
    </div>
  );
}
