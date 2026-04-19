import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/service.server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { AuthIdentitySync } from "@/components/auth-identity-sync";

/**
 * Authenticated dashboard shell.
 *
 * Layout: full-viewport flex row with the persistent <Sidebar /> rail on
 * the left and a vertically-stacked main column on the right. The body
 * (`app/layout.tsx`) already enforces `h-screen flex overflow-hidden`,
 * so the sidebar provides its own width and the main column flexes to
 * fill the remaining space and owns its own overflow.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <AuthIdentitySync user={user} provider={user.provider} />
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg">{children}</main>
      </div>
    </>
  );
}
