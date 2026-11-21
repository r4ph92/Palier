ALTER TABLE "parking_session" ADD COLUMN "parked_asked_at" timestamp with time zone;--> statement-breakpoint
-- Every session that was asked where it parked has its aisle; before #146 the question's instant was parked_at, the best we know.
UPDATE "parking_session" SET "parked_asked_at" = "parked_at" WHERE "parked_aisle_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_unconfirmed_has_question" CHECK ("parking_session"."state"::text <> 'PARKED_UNCONFIRMED' or "parking_session"."parked_asked_at" is not null);
