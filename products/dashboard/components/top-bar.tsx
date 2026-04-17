import { CircleDot } from "lucide-react";
import type { AuthUser } from "@/lib/auth/types";
import { SignOutButton } from "@/components/sign-out-button";

export function TopBar({ user }: { user: AuthUser }) {
  const normalizedEmail = user.email?.trim() || null;
  const initials = (normalizedEmail ?? "A").slice(0, 1).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left — breadcrumb / page title slot */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900">Dashboard</span>
      </div>

      {/* Right — context area */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1">
          <CircleDot className="h-3 w-3 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-700">
            Planning
          </span>
        </div>

        <div className="hidden text-xs text-slate-500 sm:block">
          {normalizedEmail ?? "Authenticated"}
        </div>

        <SignOutButton provider={user.provider} />

        {/* Avatar placeholder */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials}
        </div>
      </div>
    </header>
  );
}
