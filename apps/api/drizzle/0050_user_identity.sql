CREATE TYPE "public"."identity_provider" AS ENUM('APPLE', 'GOOGLE');--> statement-breakpoint
CREATE TABLE "user_identity" (
	"provider" "identity_provider" NOT NULL,
	"subject" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identity_provider_subject_unique" UNIQUE("provider","subject")
);
--> statement-breakpoint
ALTER TABLE "user_identity" ADD CONSTRAINT "user_identity_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_identity_user_id_index" ON "user_identity" USING btree ("user_id");