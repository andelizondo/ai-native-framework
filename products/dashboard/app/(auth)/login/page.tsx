import { Suspense } from "react";
import { LoginPageClient } from "@/components/login-page-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense fallback={null}>
      <LoginPageClient urlError={params?.error} />
    </Suspense>
  );
}
