CREATE TYPE "assets"."style_type" AS ENUM('visual', 'video', 'writing', 'audio', 'ui', 'mixed');--> statement-breakpoint
CREATE TABLE "assets"."style_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"style_type" "assets"."style_type" NOT NULL,
	"positive_prompt" text,
	"negative_prompt" text,
	"color_palette" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommended_model" varchar(120),
	"recommended_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."style_assets" ADD CONSTRAINT "style_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "style_assets_asset_id_unique" ON "assets"."style_assets" USING btree ("asset_id");