import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';

export function assertApprovalReviewer(
  status: ApprovalStatus,
  requestedBy: string,
  reviewerId: string,
) {
  if (requestedBy === reviewerId) {
    throw new ForbiddenException({ code: 'APPROVAL_SELF_REVIEW_FORBIDDEN' });
  }
  if (status !== ApprovalStatus.PENDING_APPROVAL) {
    throw new ConflictException({ code: 'APPROVAL_REQUEST_NOT_PENDING' });
  }
}
