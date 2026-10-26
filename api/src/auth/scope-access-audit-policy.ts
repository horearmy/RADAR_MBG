export function classifyScopeAccessDenial(status: number, code: string | undefined) {
  if (status === 403 && code === 'SCOPE_FORBIDDEN') {
    return { outcome: 'out_of_scope' as const };
  }
  if (status === 404 && code?.endsWith('_NOT_FOUND')) {
    return { outcome: 'not_found_or_out_of_scope' as const };
  }
  return null;
}
