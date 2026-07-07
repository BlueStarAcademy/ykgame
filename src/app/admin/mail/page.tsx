import { AdminMailPanel } from "@/components/admin/AdminMailPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminMailPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminMailPanel />;
}
