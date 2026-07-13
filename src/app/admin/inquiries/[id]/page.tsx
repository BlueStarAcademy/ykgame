import { AdminInquiryDetailPanel } from "@/components/admin/AdminInquiryDetailPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/home");
  }

  const { id } = await params;
  return <AdminInquiryDetailPanel inquiryId={id} />;
}
