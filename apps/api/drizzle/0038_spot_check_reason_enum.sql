CREATE TYPE "public"."spot_check_reason" AS ENUM('WRONG_AISLE', 'WRONG_SPOT', 'REPORTED_TAKEN');--> statement-breakpoint
ALTER TABLE "spot" DROP CONSTRAINT "spot_needs_check_reason_known";--> statement-breakpoint
ALTER TABLE "spot" ALTER COLUMN "needs_check_reason" SET DATA TYPE "public"."spot_check_reason" USING "needs_check_reason"::"public"."spot_check_reason";--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_needs_check_reason_only_when_flagged" CHECK ("spot"."needs_check" or "spot"."needs_check_reason" is null);