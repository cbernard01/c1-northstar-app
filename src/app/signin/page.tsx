import { redirect } from "next/navigation";

import { MicrosoftSignInButton } from "@/components/microsoft-signin-button";
import { auth } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const resolvedSearchParams = await searchParams;

  if (session) {
    redirect(resolvedSearchParams.callbackUrl || "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Welcome to C1 Northstar</h1>
          <p className="mt-2 text-gray-300">Sign in with your Microsoft account to continue</p>
        </div>
        <MicrosoftSignInButton callbackUrl={resolvedSearchParams.callbackUrl} />
      </div>
    </div>
  );
}
