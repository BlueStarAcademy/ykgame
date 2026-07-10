import { AdminCouponsPanel } from "@/components/admin/AdminCouponsPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminCouponsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminCouponsPanel />;
}
