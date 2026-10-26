import { classifyScopeAccessDenial } from './scope-access-audit-policy.js';

describe('scope access audit classification', () => {
  it('classifies explicit scope denials without changing the response status', () => {
    expect(classifyScopeAccessDenial(403, 'SCOPE_FORBIDDEN'))
      .toEqual({ outcome: 'out_of_scope' });
  });

  it('records scoped not-found responses without revealing whether an object exists', () => {
    expect(classifyScopeAccessDenial(404, 'TRIP_NOT_FOUND'))
      .toEqual({ outcome: 'not_found_or_out_of_scope' });
  });

  it('ignores unrelated authorization and validation failures', () => {
    expect(classifyScopeAccessDenial(403, 'PERMISSION_FORBIDDEN')).toBeNull();
    expect(classifyScopeAccessDenial(404, 'INVALID_DESTINATION')).toBeNull();
    expect(classifyScopeAccessDenial(400, 'TRIP_NOT_FOUND')).toBeNull();
  });
});
