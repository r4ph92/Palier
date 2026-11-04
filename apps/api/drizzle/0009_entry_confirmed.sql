DROP INDEX "parking_session_one_active_per_user_index";--> statement-breakpoint
DROP INDEX "parking_session_one_active_per_spot_index";--> statement-breakpoint
ALTER TYPE "public"."parking_session_state" RENAME TO "parking_session_state_old";--> statement-breakpoint
CREATE TYPE "public"."parking_session_state" AS ENUM('CREATED', 'ENTRY_CONFIRMED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "state" TYPE "public"."parking_session_state" USING "state"::text::"public"."parking_session_state";--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "state" SET DEFAULT 'CREATED';--> statement-breakpoint
DROP TYPE "public"."parking_session_state_old";--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "entry_confirmed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_user_index" ON "parking_session" USING btree ("user_id") WHERE state in ('CREATED', 'ENTRY_CONFIRMED');--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_spot_index" ON "parking_session" USING btree ("assigned_spot_id") WHERE state in ('CREATED', 'ENTRY_CONFIRMED');
