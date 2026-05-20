ALTER TABLE `members` ADD `research_areas` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `members` ADD `honorary` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `members` ADD `exempt_from_payment` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `members` ADD `expelled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `members` ADD `expulsion_date` text;--> statement-breakpoint
ALTER TABLE `members` ADD `expulsion_reason` text;--> statement-breakpoint
ALTER TABLE `members` ADD `deceased` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `members` ADD `death_date` text;--> statement-breakpoint
ALTER TABLE `members` ADD `access_rights` text;