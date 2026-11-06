import { AdminHourlyAdsPanel } from "@/components/admin/AdminHourlyAdsPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminHourlyAdsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminHourlyAdsPanel />;
}
