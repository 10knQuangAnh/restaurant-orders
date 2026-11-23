import { currentStaff } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) redirect("/staff");
  if (staff.role !== "admin") redirect(staff.role === "kitchen" ? "/staff/kitchen" : "/staff/floor");
  return children;
}
