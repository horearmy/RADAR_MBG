import UserManagementClient from "./user-management-client";

export const instant = false;

export default async function UserManagementPage({ searchParams }: PageProps<"/user-management">) {
  const params = await searchParams;
  const requestedTab = params.tab;
  const initialTab = requestedTab === "approvals" ? "approvals" : "accounts";
  return <UserManagementClient initialTab={initialTab} />;
}
