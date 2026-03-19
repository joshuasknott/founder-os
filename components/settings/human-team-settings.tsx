"use client";

import * as React from "react";
import { MoreHorizontal, UserPlus, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
type Role = "Owner" | "Contributor";

interface HumanMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  avatarUrl?: string; // Optional since they might not have one
}

const mockMembers: HumanMember[] = [
  {
    id: "hm_01",
    name: "Joshua Knott",
    email: "joshua@founderos.com",
    role: "Owner",
    joinedAt: "2024-01-15",
  },
  {
    id: "hm_02",
    name: "Sarah Jenkins",
    email: "sarah@founderos.com",
    role: "Contributor",
    joinedAt: "2024-02-01",
  },
  {
    id: "hm_03",
    name: "Michael Chen",
    email: "michael@founderos.com",
    role: "Contributor",
    joinedAt: "2024-03-10",
  },
];

export function HumanTeamSettings() {
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("Contributor");
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const [inviteError, setInviteError] = React.useState("");

  // Close menus when clicking outside
  React.useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    if (!inviteEmail) return;
    if (!inviteEmail.includes("@")) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    // In a real app this would trigger the email invitation
    setInviteEmail("");
    setInviteRole("Contributor");
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
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <button
              type="submit"
              disabled={!inviteEmail}
              className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 text-sm font-medium text-white transition-opacity bg-black rounded-none hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              Send Invite
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
          {mockMembers.map((member) => (
            <div
              key={member.id}
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
                  <span className="text-sm text-zinc-600">{member.joinedAt}</span>
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
                      setActiveMenuId(activeMenuId === member.id ? null : member.id);
                    }}
                    className="p-2 text-zinc-400 transition-colors rounded-none hover:text-black hover:bg-zinc-100"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  {/* 3-Dot Dropdown Actions */}
                  {activeMenuId === member.id && (
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
                          onClick={() => setActiveMenuId(null)}
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
        </div>
      </div>
    </div>
  );
}
