import Link from "next/link";

import { auth } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";
import { MicrosoftSignInButton } from "@/components/microsoft-signin-button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">Welcome to C1 Northstar</h1>
        <p className="mt-4 text-lg text-gray-300">
          Enterprise application with Microsoft Entra ID authentication
        </p>
        <div className="mt-8 flex justify-center">
          {session ? (
            <Button asChild size="lg">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <MicrosoftSignInButton />
          )}
        </div>
      </div>
    </main>
  );
}