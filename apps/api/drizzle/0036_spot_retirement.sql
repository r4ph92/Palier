ALTER TABLE "spot" DROP CONSTRAINT "spot_lot_id_number_unique";--> statement-breakpoint
ALTER TABLE "spot" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "spot_lot_id_number_unique" ON "spot" USING btree ("lot_id","number") WHERE "spot"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "parking_session_assigned_spot_id_lot_id_index" ON "parking_session" USING btree ("assigned_spot_id","lot_id");--> statement-breakpoint
CREATE INDEX "parking_session_confirmed_spot_id_lot_id_index" ON "parking_session" USING btree ("confirmed_spot_id","lot_id");--> statement-breakpoint
CREATE INDEX "parking_session_reported_spot_spot_id_lot_id_index" ON "parking_session_reported_spot" USING btree ("spot_id","lot_id");--> statement-breakpoint
CREATE INDEX "spot_hold_spot_id_lot_id_index" ON "spot_hold" USING btree ("spot_id","lot_id");--> statement-breakpoint
ALTER TABLE "spot" ADD CONSTRAINT "spot_retired_out_of_service" CHECK ("spot"."retired_at" is null or "spot"."state" = 'OUT_OF_SERVICE');