CREATE TYPE "public"."exit_id_kind" AS ENUM('ANPR', 'RFID', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."gate_integration_kind" AS ENUM('DRY_CONTACT', 'ACCESS_CONTROL_API', 'SIMULATED');--> statement-breakpoint
CREATE TYPE "public"."gate_kind" AS ENUM('ENTRY', 'EXIT');--> statement-breakpoint
CREATE TABLE "gate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "gate_kind" NOT NULL,
	"integration_kind" "gate_integration_kind" NOT NULL,
	"endpoint" text,
	"has_loops" boolean DEFAULT false NOT NULL,
	"exit_id_kind" "exit_id_kind" DEFAULT 'NONE' NOT NULL,
	"qr_secret" text,
	"verified_at" timestamp with time zone,
	CONSTRAINT "gate_lot_id_name_unique" UNIQUE("lot_id","name"),
	CONSTRAINT "gate_id_lot_id_unique" UNIQUE("id","lot_id")
);
--> statement-breakpoint
CREATE TABLE "gate_device_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "gate_device_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "gate_passage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gate" ADD CONSTRAINT "gate_lot_id_parking_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_device_key" ADD CONSTRAINT "gate_device_key_gate_id_gate_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_passage" ADD CONSTRAINT "gate_passage_gate_in_same_lot_fk" FOREIGN KEY ("gate_id","lot_id") REFERENCES "public"."gate"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gate_device_key_gate_id_index" ON "gate_device_key" USING btree ("gate_id");--> statement-breakpoint
CREATE INDEX "gate_passage_gate_id_recorded_at_index" ON "gate_passage" USING btree ("gate_id","recorded_at");