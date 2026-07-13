import { AdminGameInfoPanel } from "@/components/admin/AdminGameInfoPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function AdminGameInfoPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-slate-400">불러오는 중...</p>}>
      <AdminGameInfoPanel />
    </Suspense>
  );
}
