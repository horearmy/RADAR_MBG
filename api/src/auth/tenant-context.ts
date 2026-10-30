export type TenantContext = {
  userId: string;
  tenantId: string;
  membershipId: string;
  role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER';
  permissions: string[];
};

export function buildTenantContext(input: TenantContext): TenantContext {
  return input;
}
