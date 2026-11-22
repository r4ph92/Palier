ALTER TYPE "public"."spot_check_reason" ADD VALUE 'STALE_SESSION';--> statement-breakpoint
ALTER TYPE "public"."exit_identification" ADD VALUE 'STAFF';--> statement-breakpoint
ALTER TYPE "public"."parking_session_state" ADD VALUE 'CLOSED_BY_STAFF';--> statement-breakpoint
ALTER TABLE "event_log" DROP CONSTRAINT "event_log_kind_known";--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "staff_closed_by" uuid;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_staff_closed_by_app_user_id_fk" FOREIGN KEY ("staff_closed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_closed_by_staff_has_exit" CHECK ("parking_session"."state"::text <> 'CLOSED_BY_STAFF' or ("parking_session"."exit_at" is not null and "parking_session"."exit_identification"::text = 'STAFF' and "parking_session"."staff_closed_by" is not null and "parking_session"."captured_cents" is null));--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_kind_known" CHECK ("event_log"."kind" in ('ENTRY_SCANNED', 'GATE_OPENED', 'ENTRY_LOOP_CLOSED', 'AISLE_DETECTED', 'PARKING_PRESUMED', 'PARKING_CONFIRMED', 'ENTRY_CANCELLED', 'EXIT_IDENTIFIED', 'CAPTURED', 'CAPTURE_PENDING', 'EXIT_LOOP_CLOSED', 'PRESENCE_CONFIRMED', 'CLOSED_BY_STAFF'));