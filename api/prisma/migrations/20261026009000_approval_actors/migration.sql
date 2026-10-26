ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_requests_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_decisions"
    ADD CONSTRAINT "approval_decisions_approver_id_fkey"
    FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
