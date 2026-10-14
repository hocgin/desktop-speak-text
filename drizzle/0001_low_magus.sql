CREATE TABLE `speak_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`voice_name` text NOT NULL,
	`rate` real DEFAULT 1 NOT NULL,
	`volume` real DEFAULT 1 NOT NULL,
	`pitch` real DEFAULT 0 NOT NULL,
	`language` text DEFAULT 'zh-CN' NOT NULL,
	`audio_path` text,
	`duration` integer,
	`word_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
