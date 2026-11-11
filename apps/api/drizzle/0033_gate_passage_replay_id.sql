ALTER TABLE "gate_passage" ADD COLUMN "replay_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "gate_passage_gate_id_replay_id_unique" ON "gate_passage" USING btree ("gate_id","replay_id");