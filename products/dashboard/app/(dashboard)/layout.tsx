import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/service.server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { AuthIdentitySync } from "@/components/auth-identity-sync";

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
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AuthIdentitySync user={user} provider={user.provider} />
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6">{children}</main>
      </div>
    </>
  );
}
