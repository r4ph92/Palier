CREATE TYPE "public"."exit_identification" AS ENUM('APP');--> statement-breakpoint
ALTER TYPE "public"."parking_session_state" ADD VALUE 'CLOSED_PAID';--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "exit_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "exit_identification" "exit_identification";--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "captured_cents" integer;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_paid_has_exit" CHECK ("parking_session"."state"::text <> 'CLOSED_PAID' or ("parking_session"."exit_at" is not null and "parking_session"."exit_identification" is not null and "parking_session"."captured_cents" is not null));