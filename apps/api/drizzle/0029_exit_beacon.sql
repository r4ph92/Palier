ALTER TYPE "public"."exit_identification" ADD VALUE 'BEACON';--> statement-breakpoint
CREATE TABLE "exit_beacon_report" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"reported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exit_vehicle_presence" (
	"gate_id" uuid PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exit_beacon_report" ADD CONSTRAINT "exit_beacon_report_session_id_parking_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."parking_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_vehicle_presence" ADD CONSTRAINT "exit_vehicle_presence_gate_id_gate_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gate"("id") ON DELETE no action ON UPDATE no action;