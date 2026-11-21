DROP INDEX "gate_command_gate_id_issued_at_index";--> statement-breakpoint
ALTER TABLE "gate" ADD COLUMN "last_command_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gate_command" ADD COLUMN "sequence" integer;--> statement-breakpoint
-- The commands stored before #100 keep the order the console showed them in: issue time, then id.
UPDATE "gate_command" SET "sequence" = numbered.sequence
FROM (SELECT "id", row_number() OVER (PARTITION BY "gate_id" ORDER BY "issued_at", "id") AS sequence FROM "gate_command") AS numbered
WHERE "gate_command"."id" = numbered."id";--> statement-breakpoint
UPDATE "gate" SET "last_command_sequence" = counted.last
FROM (SELECT "gate_id", max("sequence") AS last FROM "gate_command" GROUP BY "gate_id") AS counted
WHERE "gate"."id" = counted."gate_id";--> statement-breakpoint
ALTER TABLE "gate_command" ALTER COLUMN "sequence" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gate_command" ADD CONSTRAINT "gate_command_gate_id_sequence_unique" UNIQUE("gate_id","sequence");
