INSERT INTO "aisle" ("level_id", "lot_id", "code", "beacon_minor", "is_exit_lane")
SELECT DISTINCT ON ("level"."lot_id") "level"."id", "level"."lot_id", 'Sortie', 0, true
FROM "level"
WHERE NOT EXISTS (SELECT 1 FROM "aisle" WHERE "aisle"."lot_id" = "level"."lot_id" AND "aisle"."is_exit_lane")
ORDER BY "level"."lot_id", "level"."display_order", "level"."code";--> statement-breakpoint
ALTER TABLE "aisle" ADD CONSTRAINT "aisle_beacon_minor_matches_lane" CHECK (("aisle"."is_exit_lane" and "aisle"."beacon_minor" = 0) or (not "aisle"."is_exit_lane" and "aisle"."beacon_minor" between 1 and 65535));