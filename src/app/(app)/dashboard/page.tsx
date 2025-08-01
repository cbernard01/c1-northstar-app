import { auth } from "@/app/(auth)/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {session?.user?.name}!</CardTitle>
          <CardDescription>
            You are successfully authenticated using Microsoft Entra ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Email:</span> {session?.user?.email}
            </p>
            <p className="text-sm">
              <span className="font-medium">ID:</span> {session?.user?.id}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}