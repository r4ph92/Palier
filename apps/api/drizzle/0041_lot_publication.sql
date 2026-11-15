ALTER TABLE "parking_lot" ADD COLUMN "wifi_note" text;--> statement-breakpoint
ALTER TABLE "parking_lot" ADD COLUMN "cell_note" text;--> statement-breakpoint
UPDATE "parking_lot" SET "wifi_note" = 'Mesure antérieure à la mise en ligne vérifiée.' WHERE "wifi_verified_at" IS NOT NULL;--> statement-breakpoint
UPDATE "parking_lot" SET "cell_note" = 'Mesure antérieure à la mise en ligne vérifiée.' WHERE "cell_verified_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_wifi_attestation_complete" CHECK (("parking_lot"."wifi_verified_at" is null) = ("parking_lot"."wifi_note" is null));--> statement-breakpoint
ALTER TABLE "parking_lot" ADD CONSTRAINT "parking_lot_cell_attestation_complete" CHECK (("parking_lot"."cell_verified_at" is null) = ("parking_lot"."cell_note" is null));
