CREATE TABLE `planSegments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`startDay` int NOT NULL,
	`endDay` int NOT NULL,
	`status` enum('pending','generated') NOT NULL DEFAULT 'pending',
	`detailJson` json,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planSegments_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_segments_range_unique` UNIQUE(`planId`,`startDay`,`endDay`)
);
--> statement-breakpoint
ALTER TABLE `planSegments` ADD CONSTRAINT `planSegments_planId_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `plan_segments_status_idx` ON `planSegments` (`planId`,`status`,`startDay`);