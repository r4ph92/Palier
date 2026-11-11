CREATE TYPE "public"."parking_session_presumption" AS ENUM('WALK', 'TIMEOUT');--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "presumed_by" "parking_session_presumption";--> statement-breakpoint
UPDATE "parking_session" SET "presumed_by" = 'WALK' WHERE "state" = 'PARKED_PRESUMED';--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_presumed_has_evidence" CHECK ("parking_session"."state"::text <> 'PARKED_PRESUMED' or "parking_session"."presumed_by" is not null);