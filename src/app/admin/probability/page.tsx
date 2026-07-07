import { AdminProbabilityPanel } from "@/components/admin/AdminProbabilityPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminProbabilityPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminProbabilityPanel />;
}
