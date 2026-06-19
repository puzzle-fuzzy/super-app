CREATE TABLE "assets"."asset_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"token" varchar(96) NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."asset_share_links" ADD CONSTRAINT "asset_share_links_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets"."asset_share_links" ADD CONSTRAINT "asset_share_links_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_share_links_token_unique" ON "assets"."asset_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "asset_share_links_asset_id_idx" ON "assets"."asset_share_links" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_share_links_owner_id_idx" ON "assets"."asset_share_links" USING btree ("owner_id");