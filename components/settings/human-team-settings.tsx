"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MoreHorizontal, UserPlus, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "Owner" | "Contributor" | "Viewer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPO_DOMAINS = [
  "gmaiil.com",
  "gmal.com",
  "gamil.com",
  "gmail.co",
  "gmail.con",
  "yaho.com",
  "yahoo.co",
  "hotmial.com",
  "outlook.co"
];

export function HumanTeamSettings() {
  const workspaces = useQuery(api.workspaces.get);
  const workspaceId = workspaces?.[0]?._id as Id<"workspaces"> | undefined;

  const members = useQuery(api.users.get);
  const inviteMutation = useMutation(api.users.invite);
  const removeMutation = useMutation(api.users.remove);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("Contributor");
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const [inviteError, setInviteError] = React.useState("");
  const [isInviting, setIsInviting] = React.useState(false);

  // Close menus when clicking outside
  React.useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    
    const cleanEmail = inviteEmail.trim();
    if (!cleanEmail) return;

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setInviteError("Please enter a valid email structure (e.g., user@domain.com).");
      return;
    }

    const domain = cleanEmail.split("@")[1]?.toLowerCase();
    if (domain && TYPO_DOMAINS.includes(domain)) {
      setInviteError(`Invalid domain "@${domain}" detected. Please check for common typos.`);
      return;
    }

    if (!workspaceId) {
      setInviteError("No workspace found. Please seed the database first.");
      return;
    }
    setIsInviting(true);
    try {
      await inviteMutation({ workspaceId, email: cleanEmail, role: inviteRole });
      setInviteEmail("");
      setInviteRole("Contributor");
    } catch {
      setInviteError("Failed to send invite. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (userId: Id<"users">) => {
    setActiveMenuId(null);
    try {
      await removeMutation({ userId });
    } catch {
      // Silently fail for now; toast system will be added later
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-8">
      {/* Top Section: Invite */}
      <div className="p-6 bg-white border border-zinc-200">
        <h3 className="mb-1 text-lg font-semibold text-black">Invite Member</h3>
        <p className="mb-4 text-sm text-zinc-500">
          Invite new members to your Corporate Workspace. They will receive an email invitation to join.
        </p>

        <form onSubmit={handleInvite} className="flex flex-col gap-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <input
                type="text"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }}
                placeholder="name@company.com"
                className="w-full px-3 py-2 text-sm text-black border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-zinc-400 rounded-none bg-white"
              />
            </div>

            <div className="relative w-full sm:w-[180px]">
              <select
                title="Select Role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full px-3 py-2 pr-8 text-sm text-black bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black appearance-none cursor-pointer rounded-none"
              >
                <option value="Contributor">Contributor</option>
                <option value="Owner">Owner</option>
                <option value="Viewer">Viewer</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <button
              type="submit"
              disabled={!inviteEmail || isInviting}
              className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 text-sm font-medium text-white transition-opacity bg-black rounded-none hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              {isInviting ? "Inviting..." : "Send Invite"}
            </button>
          </div>
          {inviteError && <p className="text-red-500 text-xs mt-1">{inviteError}</p>}
        </form>
      </div>

      {/* Bottom Section: Active Members */}
      <div className="bg-white border border-zinc-200">
        <div className="p-6 border-b border-zinc-200">
          <h3 className="mb-1 text-lg font-semibold text-black">Active Members</h3>
          <p className="text-sm text-zinc-500">
            Manage your current corporate team. Owners have full administrative clearance.
          </p>
        </div>

        <div className="flex flex-col">
          {/* Loading skeleton */}
          {members === undefined && (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 last:border-0 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-none bg-zinc-200 shrink-0" />
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3.5 w-32 rounded-sm bg-zinc-200" />
                    <div className="h-3 w-44 rounded-sm bg-zinc-100" />
                  </div>
                </div>
                <div className="h-6 w-24 rounded-sm bg-zinc-100" />
              </div>
            ))
          )}

          {/* Live member rows */}
          {members?.map((member) => (
            <div
              key={member._id}
              className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 bg-zinc-100 text-zinc-500 rounded-none shrink-0 border border-zinc-200">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={`${member.name} avatar`} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-black leading-tight">{member.name}</span>
                  <span className="text-sm text-zinc-500 leading-tight">{member.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-6 pr-6">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Joined</span>
                  <span className="text-sm text-zinc-600">
                    {new Date(member.joinedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>

                <div className={cn(
                  "px-2.5 py-1 text-xs font-mono tracking-tight uppercase border w-24 text-center",
                  member.role === "Owner"
                    ? "bg-black text-white border-black"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                )}>
                  {member.role}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    title="Menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === member._id ? null : member._id);
                    }}
                    className="p-2 text-zinc-400 transition-colors rounded-none hover:text-black hover:bg-zinc-100"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  {activeMenuId === member._id && (
                    <div
                      className="absolute right-0 z-50 w-40 mt-1 bg-white border border-zinc-200 shadow-sm animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col py-1">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm text-left text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors"
                          onClick={() => setActiveMenuId(null)}
                        >
                          Change Role
                        </button>
                        <div className="h-px bg-zinc-200 my-1" />
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors font-medium"
                          onClick={() => handleRemove(member._id as Id<"users">)}
                        >
                          Remove Member
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {members !== undefined && members.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <User className="w-8 h-8 mb-2" />
              <p className="text-sm font-medium">No members yet.</p>
              <p className="text-xs">Invite someone above to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
