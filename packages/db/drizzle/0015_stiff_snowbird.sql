CREATE TYPE "public"."canvas_pipeline_asset_category" AS ENUM('analysis', 'characterProfile', 'locationProfile', 'characterPortrait', 'characterTurnaround', 'locationRef', 'storyboard', 'continuityReport', 'videoPrompt', 'shotVideo');--> statement-breakpoint
CREATE TYPE "public"."canvas_pipeline_asset_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."canvas_pipeline_project_status" AS ENUM('draft', 'analyzed', 'characters_ready', 'locations_ready', 'refs_ready', 'refs_all_ready', 'storyboard_ready', 'continuity_checked', 'prompts_ready', 'generating', 'partial_failed', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."canvas_pipeline_phase" AS ENUM('analyze', 'characters', 'locations', 'characterRefs', 'locationRefs', 'storyboard', 'continuity', 'rebuild', 'dialogue', 'videos', 'bgm', 'assemble');--> statement-breakpoint
CREATE TYPE "public"."canvas_pipeline_run_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."canvas_pipeline_shot_status" AS ENUM('draft', 'ready', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provider_model_health_status" AS ENUM('healthy', 'degraded');--> statement-breakpoint
CREATE TYPE "public"."subtitle_project_status" AS ENUM('draft', 'extracting_audio', 'asr_processing', 'subtitle_editing', 'exporting', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "canvas_pipeline_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category" "canvas_pipeline_asset_category" NOT NULL,
	"target_entity_type" varchar(50) NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"status" "canvas_pipeline_asset_status" DEFAULT 'queued' NOT NULL,
	"model" varchar(100),
	"pipeline_run_id" uuid,
	"task_id" uuid,
	"input_json" jsonb,
	"output_json" jsonb,
	"public_url" text,
	"storage_path" text,
	"provider_url" text,
	"cost" jsonb,
	"total_price_cents" numeric(20, 4),
	"error_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_pipeline_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"role" varchar(50),
	"description" text,
	"identity_prompt" text,
	"negative_prompt" text,
	"profile_json" jsonb,
	"reference_image_url" text,
	"turnaround_sheet_url" text,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_pipeline_continuity_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issues_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_pipeline_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(50) DEFAULT 'mixed' NOT NULL,
	"profile_json" jsonb,
	"scene_prompt" text,
	"negative_prompt" text,
	"reference_image_url" text,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_pipeline_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(500),
	"story_text" text NOT NULL,
	"status" "canvas_pipeline_project_status" DEFAULT 'draft' NOT NULL,
	"analysis_json" jsonb,
	"model_preferences_json" jsonb,
	"canvas_layout" jsonb,
	"bgm_url" text,
	"final_video_url" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase" "canvas_pipeline_phase" NOT NULL,
	"status" "canvas_pipeline_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"created_by" uuid,
	"input_snapshot_json" jsonb,
	"output_summary_json" jsonb,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_pipeline_shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"shot_index" integer NOT NULL,
	"duration" integer DEFAULT 5 NOT NULL,
	"location_id" uuid,
	"character_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"narrative" text NOT NULL,
	"camera_json" jsonb NOT NULL,
	"continuity_json" jsonb NOT NULL,
	"timeline_json" jsonb,
	"environment_json" jsonb,
	"video_prompt" text,
	"negative_prompt" text,
	"video_task_id" varchar(255),
	"video_url" text,
	"status" "canvas_pipeline_shot_status" DEFAULT 'draft' NOT NULL,
	"error_message" text,
	"reference_assets_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dialogue_prompt" text,
	"dialogue_json" jsonb,
	"reference_media" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_model_health" (
	"model" varchar(100) PRIMARY KEY NOT NULL,
	"status" "provider_model_health_status" DEFAULT 'healthy' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"total_failures" integer DEFAULT 0 NOT NULL,
	"total_successes" integer DEFAULT 0 NOT NULL,
	"degraded_until" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error_message" text,
	"degraded_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtitle_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"video_file_id" uuid NOT NULL,
	"video_url" text NOT NULL,
	"audio_file_url" text,
	"video_duration_ms" integer,
	"asr_record_id" uuid,
	"status" "subtitle_project_status" DEFAULT 'draft' NOT NULL,
	"raw_transcription" jsonb,
	"sentences" jsonb,
	"style_config" jsonb DEFAULT '{"templateId":"cinema","fontSize":38,"fontColor":"#FFFFFF","outlineColor":"#000000","outlineWidth":2,"position":"bottom","marginV":30,"bold":false}'::jsonb,
	"export_record_id" uuid,
	"exported_video_url" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_size" bigint NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"purpose" varchar(50) DEFAULT 'reference' NOT NULL,
	"metadata" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_assets" ADD CONSTRAINT "canvas_pipeline_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_assets" ADD CONSTRAINT "canvas_pipeline_assets_project_id_canvas_pipeline_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."canvas_pipeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_assets" ADD CONSTRAINT "canvas_pipeline_assets_pipeline_run_id_canvas_pipeline_runs_id_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "public"."canvas_pipeline_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_characters" ADD CONSTRAINT "canvas_pipeline_characters_project_id_canvas_pipeline_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."canvas_pipeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_continuity_reports" ADD CONSTRAINT "canvas_pipeline_continuity_reports_project_id_canvas_pipeline_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."canvas_pipeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_locations" ADD CONSTRAINT "canvas_pipeline_locations_project_id_canvas_pipeline_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."canvas_pipeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_projects" ADD CONSTRAINT "canvas_pipeline_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_runs" ADD CONSTRAINT "canvas_pipeline_runs_project_id_canvas_pipeline_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."canvas_pipeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_runs" ADD CONSTRAINT "canvas_pipeline_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_shots" ADD CONSTRAINT "canvas_pipeline_shots_project_id_canvas_pipeline_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."canvas_pipeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_pipeline_shots" ADD CONSTRAINT "canvas_pipeline_shots_location_id_canvas_pipeline_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."canvas_pipeline_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_projects" ADD CONSTRAINT "subtitle_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_projects" ADD CONSTRAINT "subtitle_projects_video_file_id_uploaded_files_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_projects" ADD CONSTRAINT "subtitle_projects_asr_record_id_generation_records_id_fk" FOREIGN KEY ("asr_record_id") REFERENCES "public"."generation_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_projects" ADD CONSTRAINT "subtitle_projects_export_record_id_generation_records_id_fk" FOREIGN KEY ("export_record_id") REFERENCES "public"."generation_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_assets_project_category" ON "canvas_pipeline_assets" USING btree ("project_id","category");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_assets_target" ON "canvas_pipeline_assets" USING btree ("target_entity_type","target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_assets_project_status" ON "canvas_pipeline_assets" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_assets_deleted_at" ON "canvas_pipeline_assets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_characters_project" ON "canvas_pipeline_characters" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_locations_project" ON "canvas_pipeline_locations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_projects_owner_created" ON "canvas_pipeline_projects" USING btree ("owner_id","is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "idx_pipeline_runs_project_phase_status" ON "canvas_pipeline_runs" USING btree ("project_id","phase","status");--> statement-breakpoint
CREATE INDEX "idx_pipeline_runs_project_created" ON "canvas_pipeline_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pipeline_runs_task" ON "canvas_pipeline_runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_shots_project_index" ON "canvas_pipeline_shots" USING btree ("project_id","shot_index");--> statement-breakpoint
CREATE INDEX "idx_canvas_pipeline_shots_ref_assets_gin" ON "canvas_pipeline_shots" USING gin ("reference_assets_json" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "idx_provider_model_health_status" ON "provider_model_health" USING btree ("status","degraded_until");--> statement-breakpoint
CREATE INDEX "idx_subtitle_projects_owner_created" ON "subtitle_projects" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_subtitle_projects_status" ON "subtitle_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_uploaded_files_owner" ON "uploaded_files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_uploaded_files_deleted_at" ON "uploaded_files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_project" ON "tasks" USING btree ("project_id");