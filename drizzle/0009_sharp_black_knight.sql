CREATE TABLE `planLocalizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`language` enum('ar','en') NOT NULL,
	`outlineJson` json NOT NULL,
	`segmentsJson` json NOT NULL,
	`aiModel` varchar(100) NOT NULL,
	`promptVersion` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planLocalizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_localizations_plan_language_unique` UNIQUE(`planId`,`language`)
);
--> statement-breakpoint
ALTER TABLE `planLocalizations` ADD CONSTRAINT `planLocalizations_planId_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `plan_localizations_plan_idx` ON `planLocalizations` (`planId`);