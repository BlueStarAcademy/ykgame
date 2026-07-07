import { AdminUserDetail } from "@/components/admin/AdminUserDetail";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  const { userId } = await params;
  return <AdminUserDetail userId={userId} />;
}
