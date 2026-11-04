ALTER TABLE "vehicle" ADD COLUMN "is_electric" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "has_accessible_permit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "is_oversize" boolean DEFAULT false NOT NULL;