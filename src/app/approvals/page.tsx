import { redirect } from "next/navigation";

export default function ApprovalsAliasPage() {
  redirect("/user-management?tab=approvals");
}
