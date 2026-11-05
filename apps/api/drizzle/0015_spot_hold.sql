CREATE TYPE "public"."spot_hold_status" AS ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'USED');--> statement-breakpoint
CREATE TABLE "spot_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"spot_id" uuid NOT NULL,
	"status" "spot_hold_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "spot_hold_expires_after_creation" CHECK ("spot_hold"."expires_at" > "spot_hold"."created_at")
);
--> statement-breakpoint
ALTER TABLE "spot_hold" ADD CONSTRAINT "spot_hold_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_hold" ADD CONSTRAINT "spot_hold_lot_id_parking_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."parking_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_hold" ADD CONSTRAINT "spot_hold_spot_in_same_lot_fk" FOREIGN KEY ("spot_id","lot_id") REFERENCES "public"."spot"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spot_hold_one_active_per_user_index" ON "spot_hold" USING btree ("user_id") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "spot_hold_one_active_per_spot_index" ON "spot_hold" USING btree ("spot_id") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "spot_hold_active_by_lot_index" ON "spot_hold" USING btree ("lot_id") WHERE status = 'ACTIVE';