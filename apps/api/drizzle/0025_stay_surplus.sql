ALTER TABLE "parking_session" ADD COLUMN "surplus_paid_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "unpaid_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_surplus_not_negative" CHECK ("parking_session"."surplus_paid_cents" >= 0 and "parking_session"."unpaid_cents" >= 0);