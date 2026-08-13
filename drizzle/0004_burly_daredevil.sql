CREATE TABLE `localCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(32) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `localCredentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `localCredentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `localCredentials` ADD CONSTRAINT `localCredentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;