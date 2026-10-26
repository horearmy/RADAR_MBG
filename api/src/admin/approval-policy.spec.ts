import { ApprovalStatus } from '@prisma/client';
import { assertApprovalReviewer } from './approval-policy.js';

describe('assertApprovalReviewer', () => {
  it('rejects self approval', () => {
    expect(() => assertApprovalReviewer(ApprovalStatus.PENDING_APPROVAL, 'user-a', 'user-a'))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'APPROVAL_SELF_REVIEW_FORBIDDEN' }) }));
  });

  it('rejects requests that are no longer pending', () => {
    expect(() => assertApprovalReviewer(ApprovalStatus.EXECUTED, 'user-a', 'user-b'))
      .toThrowError(expect.objectContaining({ response: expect.objectContaining({ code: 'APPROVAL_REQUEST_NOT_PENDING' }) }));
  });

  it('allows a different reviewer to decide a pending request', () => {
    expect(() => assertApprovalReviewer(ApprovalStatus.PENDING_APPROVAL, 'user-a', 'user-b'))
      .not.toThrow();
  });
});
