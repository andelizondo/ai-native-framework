import { ShellEvents } from "@/components/shell-events";

/**
 * Settings — placeholder.
 *
 * Real settings (profile, integrations, preferences) land in a
 * follow-up PR. This page exists so the sidebar's Workspace → Settings
 * link doesn't 404 and so shell events fire on the route during PR 3.
 */
export default function SettingsPage() {
  return (
    <>
      <ShellEvents route="/settings" />
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <h1 className="text-[16px] font-semibold text-t1">Settings</h1>
        <p className="max-w-md text-[12.5px] text-t3">
          Workspace and profile settings will live here. Today, the only
          live preference is the theme toggle in the sidebar user menu.
        </p>
      </div>
    </>
  );
}
