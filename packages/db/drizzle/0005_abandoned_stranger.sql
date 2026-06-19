CREATE SCHEMA "transfers";
--> statement-breakpoint
CREATE TABLE "transfers"."transfer_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar(128) NOT NULL,
	"asset_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_rooms_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" ADD CONSTRAINT "transfer_rooms_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" ADD CONSTRAINT "transfer_rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transfer_rooms_room_id_idx" ON "transfers"."transfer_rooms" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "transfer_rooms_asset_id_idx" ON "transfers"."transfer_rooms" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "transfer_rooms_owner_id_idx" ON "transfers"."transfer_rooms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "transfer_rooms_expires_at_idx" ON "transfers"."transfer_rooms" USING btree ("expires_at");