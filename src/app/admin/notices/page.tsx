import { AdminNoticesPanel } from "@/components/admin/AdminNoticesPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminNoticesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminNoticesPanel />;
}
