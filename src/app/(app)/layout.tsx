import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Navigation } from "@/components/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <>
      <Navigation userName={session.user?.name} />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </>
  );
}