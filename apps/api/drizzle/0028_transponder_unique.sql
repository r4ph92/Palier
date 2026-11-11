DROP INDEX "vehicle_transponder_key_index";--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_transponder_key_unique" ON "vehicle" USING btree ("transponder_key");