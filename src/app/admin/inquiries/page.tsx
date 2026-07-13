import { AdminInquiriesPanel } from "@/components/admin/AdminInquiriesPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminInquiriesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminInquiriesPanel />;
}
