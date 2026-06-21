ALTER TABLE "transfers"."transfer_rooms" DROP CONSTRAINT "transfer_rooms_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" DROP CONSTRAINT "transfer_rooms_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" ALTER COLUMN "asset_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" ADD CONSTRAINT "transfer_rooms_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers"."transfer_rooms" ADD CONSTRAINT "transfer_rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE set null ON UPDATE no action;