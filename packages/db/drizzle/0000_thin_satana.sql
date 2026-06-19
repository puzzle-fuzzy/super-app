CREATE SCHEMA "assets";
--> statement-breakpoint
CREATE SCHEMA "canvas";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TYPE "assets"."asset_kind" AS ENUM('image', 'video', 'audio', 'text', 'document', 'model', 'canvas', 'other');--> statement-breakpoint
CREATE TYPE "canvas"."canvas_project_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "identity"."user_status" AS ENUM('active', 'disabled', 'deleted');--> statement-breakpoint
CREATE TABLE "assets"."asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"tag" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets"."assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "assets"."asset_kind" NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text,
	"mime_type" varchar(255),
	"size" bigint,
	"storage_bucket" varchar(120) NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"preview_key" text,
	"width" integer,
	"height" integer,
	"duration" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "canvas"."canvas_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas"."canvas_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text,
	"cover_asset_id" uuid,
	"status" "canvas"."canvas_project_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "canvas"."canvas_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(120),
	"avatar_url" text,
	"status" "identity"."user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."asset_tags" ADD CONSTRAINT "asset_tags_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas"."canvas_documents" ADD CONSTRAINT "canvas_documents_project_id_canvas_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "canvas"."canvas_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas"."canvas_projects" ADD CONSTRAINT "canvas_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas"."canvas_projects" ADD CONSTRAINT "canvas_projects_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "assets"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas"."canvas_versions" ADD CONSTRAINT "canvas_versions_project_id_canvas_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "canvas"."canvas_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas"."canvas_versions" ADD CONSTRAINT "canvas_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_tags_asset_id_idx" ON "assets"."asset_tags" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_tags_asset_tag_unique" ON "assets"."asset_tags" USING btree ("asset_id","tag");--> statement-breakpoint
CREATE INDEX "assets_owner_id_idx" ON "assets"."assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "assets_kind_idx" ON "assets"."assets" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_storage_unique" ON "assets"."assets" USING btree ("storage_bucket","storage_key");--> statement-breakpoint
CREATE INDEX "canvas_documents_project_id_idx" ON "canvas"."canvas_documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "canvas_projects_owner_id_idx" ON "canvas"."canvas_projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "canvas_projects_status_idx" ON "canvas"."canvas_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "canvas_versions_project_id_idx" ON "canvas"."canvas_versions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_sessions_token_hash_unique" ON "identity"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "identity_sessions_user_id_idx" ON "identity"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "identity_sessions_expires_at_idx" ON "identity"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_users_email_unique" ON "identity"."users" USING btree ("email");