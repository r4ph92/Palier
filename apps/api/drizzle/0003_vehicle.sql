CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plate" text NOT NULL,
	"plate_key" text NOT NULL,
	"province" text NOT NULL,
	CONSTRAINT "vehicle_user_id_plate_key_province_unique" UNIQUE("user_id","plate_key","province")
);
--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;