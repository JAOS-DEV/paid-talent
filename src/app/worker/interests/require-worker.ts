import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireWorkerUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "worker") {
    redirect("/auth/signin");
  }
  return session.user.id;
}
