ALTER TABLE "parking_session" ADD CONSTRAINT "parking_session_id_lot_id_unique" UNIQUE("id","lot_id");--> statement-breakpoint
CREATE TABLE "parking_session_reported_spot" (
	"session_id" uuid NOT NULL,
	"spot_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parking_session_reported_spot_pk" PRIMARY KEY("session_id","spot_id")
);
--> statement-breakpoint
ALTER TABLE "parking_session_reported_spot" ADD CONSTRAINT "parking_session_reported_spot_session_in_same_lot_fk" FOREIGN KEY ("session_id","lot_id") REFERENCES "public"."parking_session"("id","lot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_session_reported_spot" ADD CONSTRAINT "parking_session_reported_spot_spot_in_same_lot_fk" FOREIGN KEY ("spot_id","lot_id") REFERENCES "public"."spot"("id","lot_id") ON DELETE no action ON UPDATE no action;