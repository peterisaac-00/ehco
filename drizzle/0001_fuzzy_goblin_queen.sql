CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`currentLevel` enum('beginner','intermediate','advanced') NOT NULL,
	`dailyMinutes` int NOT NULL,
	`targetDurationDays` int NOT NULL,
	`status` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
	`activeSlot` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `goals_active_slot_unique` UNIQUE(`activeSlot`)
);
--> statement-breakpoint
CREATE TABLE `planEditRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`userInput` text NOT NULL,
	`decision` enum('accepted','rejected') NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planEditRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`totalDurationDays` int NOT NULL,
	`dailyMinutes` int NOT NULL,
	`status` enum('draft','approved') NOT NULL DEFAULT 'draft',
	`draftJson` json NOT NULL,
	`aiModel` varchar(100) NOT NULL,
	`promptVersion` varchar(40) NOT NULL,
	`generationCount` int NOT NULL DEFAULT 1,
	`editCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_goalId_unique` UNIQUE(`goalId`)
);
--> statement-breakpoint
CREATE TABLE `quizAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`userId` int NOT NULL,
	`submittedAnswers` json NOT NULL,
	`score` int NOT NULL,
	`passed` boolean NOT NULL,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`questions` json NOT NULL,
	`passingThreshold` int NOT NULL DEFAULT 70,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quizzes_taskId_unique` UNIQUE(`taskId`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`dayNumber` int NOT NULL,
	`orderIndex` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`estimatedMinutes` int NOT NULL,
	`status` enum('locked','unlocked','in_quiz','completed') NOT NULL DEFAULT 'locked',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_plan_sequence_unique` UNIQUE(`planId`,`dayNumber`,`orderIndex`)
);
--> statement-breakpoint
ALTER TABLE `goals` ADD CONSTRAINT `goals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planEditRequests` ADD CONSTRAINT `planEditRequests_planId_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plans` ADD CONSTRAINT `plans_goalId_goals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizAttempts` ADD CONSTRAINT `quizAttempts_quizId_quizzes_id_fk` FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizAttempts` ADD CONSTRAINT `quizAttempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_planId_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `goals_owner_status_idx` ON `goals` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `plan_edits_plan_created_idx` ON `planEditRequests` (`planId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_owner_quiz_idx` ON `quizAttempts` (`userId`,`quizId`,`attemptedAt`);--> statement-breakpoint
CREATE INDEX `tasks_plan_status_sequence_idx` ON `tasks` (`planId`,`status`,`dayNumber`,`orderIndex`);