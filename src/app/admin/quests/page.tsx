import { AdminQuestsPanel } from "@/components/admin/AdminQuestsPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminQuestsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminQuestsPanel />;
}
