ALTER TABLE "spot" ADD COLUMN "needs_check_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "spot" ADD COLUMN "needs_check_reason" text;--> statement-breakpoint
UPDATE "spot" SET "needs_check_since" = "state_changed_at" WHERE "needs_check";--> statement-breakpoint
CREATE INDEX "spot_to_check_by_lot_index" ON "spot" USING btree ("lot_id") WHERE "spot"."needs_check" and "spot"."retired_at" is null;--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_needs_check_since_matches_flag" CHECK ("spot"."needs_check" = ("spot"."needs_check_since" is not null));--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_needs_check_reason_known" CHECK ("spot"."needs_check_reason" in ('WRONG_AISLE', 'REPORTED_TAKEN'));