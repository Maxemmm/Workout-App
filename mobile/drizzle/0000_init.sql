CREATE TABLE `exercise_weights` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`user_id` text,
	`exercise_id` text NOT NULL,
	`weight` real NOT NULL,
	`unit` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_weights_exercise_uq` ON `exercise_weights` (`exercise_id`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`user_id` text,
	`definition` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`user_id` text,
	`program_id` text NOT NULL,
	`session_key` text NOT NULL,
	`exercise_order` text DEFAULT '[]' NOT NULL,
	`swaps` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_layouts_program_session_uq` ON `session_layouts` (`program_id`,`session_key`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE TABLE `set_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`user_id` text,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`performed_name` text,
	`set_index` integer NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`weight` real,
	`reps` integer,
	`done_at` text,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_entries_workout_exercise_set_uq` ON `set_entries` (`workout_id`,`exercise_id`,`set_index`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `set_entries_exercise_idx` ON `set_entries` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`user_id` text,
	`program_id` text NOT NULL,
	`session_key` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`health_synced_at` text,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workouts_program_session_date_uq` ON `workouts` (`program_id`,`session_key`,`date`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `workouts_date_idx` ON `workouts` (`date`);