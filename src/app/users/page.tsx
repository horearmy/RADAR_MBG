import { redirect } from "next/navigation";

export default function UsersAliasPage() {
  redirect("/user-management?tab=accounts");
}
