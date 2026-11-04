CREATE TYPE "public"."gate_command_kind" AS ENUM('OPEN');--> statement-breakpoint
CREATE TYPE "public"."parking_session_state" AS ENUM('CREATED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "gate_command" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"kind" "gate_command_kind" NOT NULL,
	"session_id" uuid,
	"issued_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"plate" text NOT NULL,
	"lot_id" uuid NOT NULL,
	"assigned_spot_id" uuid NOT NULL,
	"entry_gate_id" uuid NOT NULL,
	"state" "parking_session_state" DEFAULT 'CREATED' NOT NULL,
	"payment_intent_id" text,
	"authorized_cents" integer NOT NULL,
	"entry_scan_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_id_lot_id_unique" UNIQUE("id","lot_id");--> statement-breakpoint
ALTER TABLE "gate_command" ADD CONSTRAINT "gate_command_session_id_parking_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."parking_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_command" ADD CONSTRAINT "gate_command_gate_in_same_lot_fk" FOREIGN KEY ("gate_id","lot_id") REFERENCES "public"."gate"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_lot_id_parking_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_entry_gate_in_same_lot_fk" FOREIGN KEY ("entry_gate_id","lot_id") REFERENCES "public"."gate"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_spot_in_same_lot_fk" FOREIGN KEY ("assigned_spot_id","lot_id") REFERENCES "public"."spot"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gate_command_gate_id_issued_at_index" ON "gate_command" USING btree ("gate_id","issued_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_user_index" ON "parking_session" USING btree ("user_id") WHERE state in ('CREATED');--> statement-breakpoint
CREATE UNIQUE INDEX "parking_session_one_active_per_spot_index" ON "parking_session" USING btree ("assigned_spot_id") WHERE state in ('CREATED');