DROP INDEX "parking_session_one_active_per_user_index";--> statement-breakpoint
DROP INDEX "parking_session_one_active_per_spot_index";--> statement-breakpoint
ALTER TYPE "public"."parking_session_state" RENAME TO "parking_session_state_old";--> statement-breakpoint
CREATE TYPE "public"."parking_session_state" AS ENUM('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "state" TYPE "public"."parking_session_state" USING "state"::text::"public"."parking_session_state";--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "state" SET DEFAULT 'CREATED';--> statement-breakpoint
DROP TYPE "public"."parking_session_state_old";--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "parked_aisle_id" uuid;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "confirmed_spot_id" uuid;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "parked_answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_confirmed_spot_in_same_lot_fk" FOREIGN KEY ("confirmed_spot_id","lot_id") REFERENCES "public"."spot"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_parked_aisle_in_same_lot_fk" FOREIGN KEY ("parked_aisle_id","lot_id") REFERENCES "public"."aisle"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_unconfirmed_has_aisle" CHECK ("parking_session"."state"::text <> 'PARKED_UNCONFIRMED' or "parking_session"."parked_aisle_id" is not null);--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_confirmed_has_spot" CHECK ("parking_session"."state"::text <> 'PARKED_CONFIRMED' or ("parking_session"."confirmed_spot_id" is not null and "parking_session"."parked_answered_at" is not null));--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_user_index" ON "parking_session" USING btree ("user_id") WHERE state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED');--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_spot_index" ON "parking_session" USING btree ("assigned_spot_id") WHERE state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED');--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_confirmed_spot_index" ON "parking_session" USING btree ("confirmed_spot_id") WHERE state in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED');
