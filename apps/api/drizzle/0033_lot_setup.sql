CREATE SEQUENCE "public"."parking_lot_beacon_major_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 65535 START WITH 4 CACHE 1;--> statement-breakpoint
SELECT setval('parking_lot_beacon_major_seq', greatest((SELECT max("beacon_major") FROM "parking_lot"), 3) + 1, false);--> statement-breakpoint
ALTER TABLE "parking_lot" ALTER COLUMN "beacon_major" SET DEFAULT nextval('parking_lot_beacon_major_seq');--> statement-breakpoint
ALTER TABLE "parking_lot" ALTER COLUMN "daily_cap_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_lot" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_lot" ALTER COLUMN "address" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "parking_lot" ADD COLUMN "hold_quota" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_pricing_complete" CHECK (("parking_lot"."pricing_policy" is null) = ("parking_lot"."daily_cap_cents" is null));--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_daily_cap_positive" CHECK ("parking_lot"."daily_cap_cents" > 0);--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_online_has_pricing" CHECK ((not "parking_lot"."is_online") or "parking_lot"."pricing_policy" is not null);--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_hold_quota_range" CHECK ("parking_lot"."hold_quota" between 0 and 50);