ALTER TABLE `speak_records` ADD `engine` text DEFAULT 'edge' NOT NULL;--> statement-breakpoint
ALTER TABLE `speak_records` ADD `model_id` text;--> statement-breakpoint
ALTER TABLE `speak_records` ADD `generation_params` text;