import { AdminWorkshopsPanel } from "@/components/admin/AdminWorkshopsPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminWorkshopsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminWorkshopsPanel />;
}
