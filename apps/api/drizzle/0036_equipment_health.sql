ALTER TABLE "aisle" ADD COLUMN "beacon_battery_percent" smallint;--> statement-breakpoint
ALTER TABLE "aisle" ADD COLUMN "beacon_battery_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gate" ADD COLUMN "last_heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aisle" ADD CONSTRAINT "aisle_beacon_battery_percent_range" CHECK ("aisle"."beacon_battery_percent" between 0 and 100);--> statement-breakpoint
ALTER TABLE "aisle" ADD CONSTRAINT "aisle_beacon_battery_reading_complete" CHECK (("aisle"."beacon_battery_percent" is null) = ("aisle"."beacon_battery_reported_at" is null));