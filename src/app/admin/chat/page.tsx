import { AdminChatPanel } from "@/components/admin/AdminChatPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminChatPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return <AdminChatPanel />;
}
