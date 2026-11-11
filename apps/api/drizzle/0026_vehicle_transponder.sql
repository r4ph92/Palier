ALTER TABLE "vehicle" ADD COLUMN "transponder" text;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "transponder_key" text;--> statement-breakpoint
CREATE INDEX "vehicle_transponder_key_index" ON "vehicle" USING btree ("transponder_key");