"use client";

import { useState, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConnectedServicesSettings } from "@/components/settings/connected-services-settings";
import { RememberedDetailsSettings } from "@/components/settings/remembered-details-settings";
import { Mail, Save, User, Camera, Building, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const user = useQuery(api.users.current);
  const workspaces = useQuery(api.workspaces.get);
  const updateProfile = useMutation(api.users.updateProfile);
  const updateWorkspace = useMutation(api.workspaces.updateDetails);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const router = useRouter();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const workspace = workspaces?.[0];
  const loading = user === undefined || workspaces === undefined;

  useEffect(() => {
    if (user && workspace) {
      queueMicrotask(() => {
        setName(user.name);
        setEmail(user.email);
        setAvatarUrl(user.avatarUrl ?? "");
        setBusinessName(workspace.name);
      });
    }
  }, [user, workspace]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      setError("Please select an image smaller than 512KB.");
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile({ name, avatarUrl: avatarUrl.trim() || undefined });
      if (businessName.trim() && businessName.trim() !== workspace.name) {
        await updateWorkspace({ workspaceId: workspace._id, name: businessName.trim() });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save those changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount({});
      if (clerkUser?.deleteSelfEnabled) {
        await clerkUser.delete();
        router.replace("/");
      } else {
        await signOut({ redirectUrl: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
      setShowDeleteModal(false);
      setDeleting(false);
      router.replace("/");
    }
  };

  return (
    <div className="min-h-full px-8 py-7">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Account Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
            Profile details.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
            Update your profile picture, name, and email. Changes will automatically reflect across your workspace.
          </p>

          <form onSubmit={handleSave} className="mt-8 space-y-6">
            <div className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
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
                    readOnly
                    placeholder="e.g. josh@founderos.co"
                    className="h-10 w-full rounded-lg border border-black/[0.07] bg-black/[0.025] px-3 text-sm font-medium text-text-muted outline-none"
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

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition duration-150 ${
                  saved
                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                    : saving
                      ? "bg-black/60 text-white"
                    : "bg-black text-white hover:bg-black/90 active:scale-[0.98]"
                }`}
              >
                <Save size={15} />
                {saved ? "Saved Profile" : saving ? "Saving" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        <RememberedDetailsSettings />

        <ConnectedServicesSettings />

        <div className="max-w-2xl mt-12">
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-700">Danger Zone</h3>
            <p className="mt-1 text-sm text-red-600/80">
              This removes your FounderOS profile from the current workspace. Workspace history may remain for audit and team continuity.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 active:scale-[0.98] transition cursor-pointer"
            >
              <Trash2 size={15} />
              Delete Account
            </button>
          </div>
        </div>

        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/30 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-lg border border-red-200 bg-white shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
                <h2 className="text-lg font-semibold tracking-tight text-black">Delete Account</h2>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="p-1.5 text-zinc-400 rounded-sm hover:text-black hover:bg-zinc-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-zinc-600 leading-relaxed">
                  This will remove your FounderOS profile from this workspace. Existing workspace records may remain for audit and team continuity.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-5 py-2.5 text-sm font-semibold text-zinc-600 bg-white border border-zinc-200 hover:text-black hover:bg-zinc-50 transition-colors rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
