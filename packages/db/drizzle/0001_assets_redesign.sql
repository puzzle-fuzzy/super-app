CREATE TYPE "assets"."asset_file_role" AS ENUM('original', 'thumbnail', 'preview', 'cover', 'subtitle', 'waveform', 'attachment');--> statement-breakpoint
CREATE TYPE "assets"."asset_source" AS ENUM('upload', 'ai_generation', 'canvas_export', 'transfer', 'manual', 'import');--> statement-breakpoint
CREATE TYPE "assets"."asset_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "assets"."asset_visibility" AS ENUM('private', 'shared', 'public');--> statement-breakpoint
CREATE TABLE "assets"."asset_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" "assets"."asset_file_role" NOT NULL,
	"storage_bucket" varchar(120) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(255),
	"size" bigint,
	"width" integer,
	"height" integer,
	"duration" integer,
	"checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."assets" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "assets"."asset_kind";--> statement-breakpoint
CREATE TYPE "assets"."asset_kind" AS ENUM('subject', 'image', 'video', 'audio', 'text', 'file', 'style', 'template');--> statement-breakpoint
ALTER TABLE "assets"."assets" ALTER COLUMN "kind" SET DATA TYPE "assets"."asset_kind" USING "kind"::"assets"."asset_kind";--> statement-breakpoint
DROP INDEX "assets"."assets_kind_idx";--> statement-breakpoint
DROP INDEX "assets"."assets_storage_unique";--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD COLUMN "status" "assets"."asset_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD COLUMN "visibility" "assets"."asset_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD COLUMN "source" "assets"."asset_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD COLUMN "cover_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset_files" ADD CONSTRAINT "asset_files_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_files_asset_id_idx" ON "assets"."asset_files" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_files_storage_unique" ON "assets"."asset_files" USING btree ("storage_bucket","storage_key");--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD CONSTRAINT "assets_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "assets"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_owner_kind_idx" ON "assets"."assets" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "assets_owner_status_created_idx" ON "assets"."assets" USING btree ("owner_id","status","created_at");--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "mime_type";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "size";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "storage_bucket";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "storage_key";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "width";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "height";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP COLUMN "duration";