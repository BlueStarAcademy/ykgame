import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminProbabilityPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }
  redirect("/admin/game-info?tab=probability");
}
