ALTER TABLE "exception_cases" ALTER COLUMN "created_by_user_id" DROP NOT NULL;

ALTER TABLE "exception_events" ALTER COLUMN "actor_user_id" DROP NOT NULL;
