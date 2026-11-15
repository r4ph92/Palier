CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "event_log_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"purge_after" timestamp with time zone NOT NULL,
	CONSTRAINT "event_log_kind_known" CHECK ("event_log"."kind" in ('ENTRY_SCANNED', 'GATE_OPENED', 'ENTRY_LOOP_CLOSED', 'AISLE_DETECTED', 'PARKING_PRESUMED', 'PARKING_CONFIRMED', 'ENTRY_CANCELLED')),
	CONSTRAINT "event_log_purge_after_occurrence" CHECK ("event_log"."purge_after" > "event_log"."occurred_at")
);
--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_session_in_same_lot_fk" FOREIGN KEY ("session_id","lot_id") REFERENCES "public"."parking_session"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_log_session_id_sequence_index" ON "event_log" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "event_log_purge_after_index" ON "event_log" USING btree ("purge_after");