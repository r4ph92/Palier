ALTER TABLE "parking_session" ADD COLUMN "hold_release_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "hold_release_attempted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "gate_command_session_id_index" ON "gate_command" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "parking_session_hold_release_pending_index" ON "parking_session" USING btree ("hold_release_attempted_at" NULLS FIRST,"id") WHERE "parking_session"."hold_release_pending";