CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`birthDate` text,
	`address` text,
	`membershipNumber` text,
	`registryNumber` text,
	`joinDate` text,
	`functions` text,
	`note` text,
	`invitationSent` integer DEFAULT false,
	`role` text DEFAULT 'member',
	`password` text,
	`personal_notes` text DEFAULT '',
	`personal_todos` text DEFAULT '[]',
	`status_clana` text DEFAULT 'AKTIVAN',
	`datum_zadnje_uplate` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meeting_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`status` text DEFAULT 'present' NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meeting_participants` (
	`meeting_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`status` text DEFAULT 'present',
	PRIMARY KEY(`meeting_id`, `member_id`),
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'general',
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`minutes` text,
	`agenda` text,
	`attachments` text,
	`status` text DEFAULT 'scheduled',
	`next_meeting_date` text,
	`next_meeting_time` text,
	`next_meeting_location` text,
	`next_meeting_agenda` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active',
	`priority` text DEFAULT 'medium',
	`progress` integer DEFAULT 0,
	`start_date` text,
	`end_date` text,
	`lead_member_id` integer,
	`lead_member_name` text,
	`member_ids` text,
	`goals` text,
	`attachments` text,
	`records` text,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `library_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`broj` integer,
	`autor` text,
	`naslov` text NOT NULL,
	`podnaslov` text,
	`izdavac` text,
	`mjesto` text,
	`godina` text,
	`isbn` text,
	`uvez` text,
	`stranice` integer,
	`jezik` text DEFAULT 'Hrvatski',
	`signatura` text,
	`polica` text,
	`napomena` text,
	`attachments` text,
	`loan_member_id` integer,
	`loan_member_name` text,
	`loan_date` text,
	`loan_return_date` text,
	`loan_notes` text,
	`rights_contacted` integer DEFAULT 0,
	`rights_contact_date` text,
	`rights_responded` integer DEFAULT 0,
	`rights_response_date` text,
	`rights_consent` integer DEFAULT 0,
	`rights_attachment` text,
	`is_scanned` integer DEFAULT 0,
	`is_digitized` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `library_journals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`broj` integer,
	`naslov` text NOT NULL,
	`svesci` text,
	`podrucje` text,
	`izdavac` text,
	`issn` text,
	`napomena` text,
	`attachments` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`userName` text NOT NULL,
	`userRole` text NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`userAgent` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`email` text,
	`phone` text,
	`workplace` text,
	`category` text,
	`notes` text,
	`website` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `lectures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'lecture',
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`description` text,
	`host` text,
	`attendee_ids` text,
	`attachments` text,
	`status` text DEFAULT 'scheduled',
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`memberId` integer NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`logoUrl` text,
	`overdueAfterDays` integer DEFAULT 365,
	`inactiveAfterDays` integer DEFAULT 730,
	`availableFunctions` text,
	`googleDriveUrl` text,
	`googleServiceAccountJson` text,
	`googleDriveFolderId` text,
	`meetingTypes` text,
	`meetingLocations` text,
	`gmailMailbox` text,
	`adminBackupEmail` text,
	`adminBackupPassword` text,
	`vaultNotes` text,
	`smtpHost` text,
	`smtpPort` integer,
	`smtpUser` text,
	`smtpPass` text,
	`smtpSecure` integer DEFAULT 1,
	`smtpFrom` text
);
--> statement-breakpoint
CREATE TABLE `useful_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `vault` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`username` text,
	`password` text,
	`url` text,
	`category` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `vote_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vote_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`option` text NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`vote_id`) REFERENCES `votes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meeting_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`options` text NOT NULL,
	`status` text DEFAULT 'open',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
