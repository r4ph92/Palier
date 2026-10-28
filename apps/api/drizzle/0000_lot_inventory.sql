CREATE TYPE "public"."assignment_strategy" AS ENUM('AISLE_BY_AISLE');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('NOT_STARTED', 'PENDING', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."occupancy_source" AS ENUM('DECLARATIVE', 'SENSORS');--> statement-breakpoint
CREATE TYPE "public"."sensor_state" AS ENUM('FREE', 'OCCUPIED');--> statement-breakpoint
CREATE TYPE "public"."spot_state" AS ENUM('AVAILABLE', 'HELD', 'ASSIGNED', 'OCCUPIED', 'OCCUPIED_UNKNOWN', 'OUT_OF_SERVICE');--> statement-breakpoint
CREATE TABLE "aisle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"code" text NOT NULL,
	"beacon_minor" integer NOT NULL,
	"map_polygon" jsonb,
	"is_exit_lane" boolean DEFAULT false NOT NULL,
	CONSTRAINT "aisle_level_id_code_unique" UNIQUE("level_id","code"),
	CONSTRAINT "aisle_id_lot_id_unique" UNIQUE("id","lot_id"),
	CONSTRAINT "aisle_lot_id_beacon_minor_unique" UNIQUE("lot_id","beacon_minor")
);
--> statement-breakpoint
CREATE TABLE "level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"code" text NOT NULL,
	"display_order" integer NOT NULL,
	CONSTRAINT "level_lot_id_code_unique" UNIQUE("lot_id","code"),
	CONSTRAINT "level_id_lot_id_unique" UNIQUE("id","lot_id")
);
--> statement-breakpoint
CREATE TABLE "operator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"stripe_account_id" text,
	"kyc_status" "kyc_status" DEFAULT 'NOT_STARTED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_lot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"beacon_major" integer,
	"pricing_policy" jsonb,
	"daily_cap_cents" integer NOT NULL,
	"assignment_strategy" "assignment_strategy" DEFAULT 'AISLE_BY_AISLE' NOT NULL,
	"occupancy_source" "occupancy_source" DEFAULT 'DECLARATIVE' NOT NULL,
	"capacity" integer NOT NULL,
	"vehicle_count" integer DEFAULT 0 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"wifi_verified_at" timestamp with time zone,
	"cell_verified_at" timestamp with time zone,
	CONSTRAINT "parking_lot_beacon_major_unique" UNIQUE("beacon_major"),
	CONSTRAINT "parking_lot_capacity_not_negative" CHECK ("parking_lot"."capacity" >= 0),
	CONSTRAINT "parking_lot_vehicle_count_not_negative" CHECK ("parking_lot"."vehicle_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "spot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aisle_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"number" text NOT NULL,
	"state" "spot_state" DEFAULT 'AVAILABLE' NOT NULL,
	"state_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_ev" boolean DEFAULT false NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"is_oversize" boolean DEFAULT false NOT NULL,
	"distance_to_exit" integer NOT NULL,
	"needs_check" boolean DEFAULT false NOT NULL,
	"sensor_state" "sensor_state",
	"sensor_at" timestamp with time zone,
	CONSTRAINT "spot_lot_id_number_unique" UNIQUE("lot_id","number")
);
--> statement-breakpoint
ALTER TABLE "aisle" ADD CONSTRAINT "aisle_level_in_same_lot_fk" FOREIGN KEY ("level_id","lot_id") REFERENCES "public"."level"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level" ADD CONSTRAINT "level_lot_id_parking_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_aisle_in_same_lot_fk" FOREIGN KEY ("aisle_id","lot_id") REFERENCES "public"."aisle"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aisle_level_id_lot_id_index" ON "aisle" USING btree ("level_id","lot_id");--> statement-breakpoint
CREATE INDEX "parking_lot_operator_id_index" ON "parking_lot" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "spot_aisle_id_lot_id_index" ON "spot" USING btree ("aisle_id","lot_id");--> statement-breakpoint
CREATE INDEX "spot_available_by_aisle_index" ON "spot" USING btree ("aisle_id","state") WHERE "spot"."state" = 'AVAILABLE';