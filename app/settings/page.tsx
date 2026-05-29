"use client";

import { useState, useEffect } from "react";
import { useMockUser } from "@/hooks/use-mock-user";
import { Mail, Save, User, Camera, Building } from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser, mounted } = useMockUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (mounted) {
      queueMicrotask(() => {
        setName(user.name);
        setEmail(user.email);
        setAvatarUrl(user.avatarUrl);
        setBusinessName(user.businessName || "");
      });
    }
  }, [mounted, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 2MB to stay within localStorage constraints
    if (file.size > 2 * 1024 * 1024) {
      alert("Please select an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name, email, avatarUrl, businessName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!mounted) {
    return (
      <div className="min-h-full px-8 py-7">
        <div className="mx-auto max-w-2xl animate-pulse">
          <div className="h-4 w-20 rounded bg-black/[0.05] mb-2" />
          <div className="h-8 w-60 rounded bg-black/[0.05] mb-8" />
          <div className="h-64 rounded-lg bg-black/[0.03]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-8 py-7">
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Account Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
          Profile details.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          Update your profile picture, name, and email. Changes will automatically reflect across your workspace.
        </p>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
            {/* Functional Profile Photo Uploader */}
            <div className="flex items-center gap-5 pb-6 border-b border-black/[0.06] mb-5">
              <div className="relative h-16 w-16 rounded-full border border-black/[0.08] p-0.5 bg-surface shrink-0">
                <div className="h-full w-full rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "U")}`;
                      }}
                    />
                  ) : (
                    <span className="text-xl font-bold text-text-muted">
                      {(name || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                  <Camera size={13} className="text-text-muted" />
                  Profile Photo
                </h3>
                <p className="text-xs text-text-muted">JPG or PNG. Max size 2MB.</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("avatar-file-input")?.click()}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-semibold text-text-primary hover:bg-black/[0.02] active:scale-[0.98] transition cursor-pointer"
                  >
                    Upload from files
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl("")}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-transparent px-3 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    id="avatar-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* General Form Fields */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <User size={13} className="text-text-muted" />
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Josh Knott"
                  className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm font-medium outline-none transition duration-150 focus:border-black/20 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Mail size={13} className="text-text-muted" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. josh@founderos.co"
                  className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm font-medium outline-none transition duration-150 focus:border-black/20 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Building size={13} className="text-text-muted" />
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. FounderOS"
                  className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm font-medium outline-none transition duration-150 focus:border-black/20 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition duration-150 ${
                saved
                  ? "bg-emerald-600 text-white hover:bg-emerald-600"
                  : "bg-black text-white hover:bg-black/90 active:scale-[0.98]"
              }`}
            >
              <Save size={15} />
              {saved ? "Saved Profile" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
