ALTER TABLE "parking_session" ADD COLUMN "pricing_increment_cents" integer;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "pricing_increment_minutes" integer;--> statement-breakpoint
ALTER TABLE "parking_session" ADD COLUMN "pricing_daily_cap_cents" integer;--> statement-breakpoint
-- Existing sessions take their lot's policy; a value that is missing or not a positive whole number falls back to 75 cents per 15 minutes (docs/decisions/011).
UPDATE "parking_session" AS "session" SET
  "pricing_increment_cents" = CASE
    WHEN jsonb_typeof("lot"."pricing_policy" -> 'incrementCents') = 'number'
      AND ("lot"."pricing_policy" ->> 'incrementCents')::numeric BETWEEN 1 AND 2147483647
      AND ("lot"."pricing_policy" ->> 'incrementCents')::numeric = trunc(("lot"."pricing_policy" ->> 'incrementCents')::numeric)
    THEN ("lot"."pricing_policy" ->> 'incrementCents')::integer
    ELSE 75
  END,
  "pricing_increment_minutes" = CASE
    WHEN jsonb_typeof("lot"."pricing_policy" -> 'incrementMinutes') = 'number'
      AND ("lot"."pricing_policy" ->> 'incrementMinutes')::numeric BETWEEN 1 AND 2147483647
      AND ("lot"."pricing_policy" ->> 'incrementMinutes')::numeric = trunc(("lot"."pricing_policy" ->> 'incrementMinutes')::numeric)
    THEN ("lot"."pricing_policy" ->> 'incrementMinutes')::integer
    ELSE 15
  END,
  "pricing_daily_cap_cents" = "lot"."daily_cap_cents"
FROM "parking_lot" AS "lot"
WHERE "lot"."id" = "session"."lot_id";--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "pricing_increment_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "pricing_increment_minutes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ALTER COLUMN "pricing_daily_cap_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_pricing_positive" CHECK ("parking_session"."pricing_increment_cents" > 0 and "parking_session"."pricing_increment_minutes" > 0 and "parking_session"."pricing_daily_cap_cents" > 0);
