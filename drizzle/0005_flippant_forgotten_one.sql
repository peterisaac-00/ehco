ALTER TABLE `planSegments` ADD `generationFailedAt` timestamp;--> statement-breakpoint
ALTER TABLE `planSegments` ADD `generationFailureReason` varchar(500);--> statement-breakpoint
ALTER TABLE `plans` ADD `totalEstimatedMinutes` int DEFAULT 0 NOT NULL;