ALTER TABLE "parking_session" ADD COLUMN "is_electric" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "has_accessible_permit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "is_oversize" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Open sessions take their vehicle's needs as they are now; a session whose vehicle was deleted stays standard (story #219).
UPDATE "parking_session" AS "session" SET
  "is_electric" = "vehicle"."is_electric",
  "has_accessible_permit" = "vehicle"."has_accessible_permit",
  "is_oversize" = "vehicle"."is_oversize"
FROM "vehicle"
WHERE "vehicle"."id" = "session"."vehicle_id"
  AND "session"."state" in ('CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED');
