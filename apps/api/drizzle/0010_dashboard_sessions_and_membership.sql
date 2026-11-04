CREATE TYPE "public"."session_scope" AS ENUM('APP', 'DASHBOARD');--> statement-breakpoint
CREATE TABLE "operator_member" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"operator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_session_token" ADD COLUMN "scope" "session_scope" DEFAULT 'APP' NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_member" ADD CONSTRAINT "operator_member_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_member" ADD CONSTRAINT "operator_member_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operator_member_operator_id_index" ON "operator_member" USING btree ("operator_id");