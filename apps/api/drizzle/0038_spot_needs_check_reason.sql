CREATE TYPE "public"."spot_check_reason" AS ENUM('WRONG_AISLE', 'WRONG_SPOT', 'REPORTED_TAKEN');--> statement-breakpoint
ALTER TABLE "spot" ADD COLUMN "needs_check_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "spot" ADD COLUMN "needs_check_reason" "spot_check_reason";--> statement-breakpoint
UPDATE "spot" SET "needs_check_since" = "state_changed_at" WHERE "needs_check";--> statement-breakpoint
CREATE INDEX "spot_to_check_by_lot_index" ON "spot" USING btree ("lot_id") WHERE "spot"."needs_check" and "spot"."retired_at" is null;--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_needs_check_since_matches_flag" CHECK ("spot"."needs_check" = ("spot"."needs_check_since" is not null));--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_needs_check_reason_only_when_flagged" CHECK ("spot"."needs_check" or "spot"."needs_check_reason" is null);