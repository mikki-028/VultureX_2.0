CREATE TABLE "connection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"pair_key" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "connection_request_no_self" CHECK ("connection_requests"."sender_user_id" <> "connection_requests"."recipient_user_id")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "connection_participants_differ" CHECK ("connections"."user_a_id" <> "connections"."user_b_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_length" CHECK (char_length("messages"."body") between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" text NOT NULL,
	"body" text,
	"request_id" uuid,
	"connection_id" uuid,
	"conversation_id" uuid,
	"message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_request_id_connection_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."connection_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_connection_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."connection_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_connection_request_pair" ON "connection_requests" USING btree ("pair_key");--> statement-breakpoint
CREATE INDEX "idx_cr_recipient_status" ON "connection_requests" USING btree ("recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_cr_sender_status" ON "connection_requests" USING btree ("sender_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_connection_pair" ON "connections" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "idx_connections_user_a" ON "connections" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "idx_connections_user_b" ON "connections" USING btree ("user_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_conversation_participant" ON "conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_participant_user" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_last_message" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_notification_request" ON "notifications" USING btree ("recipient_user_id","type","request_id") WHERE "notifications"."request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_notification_message" ON "notifications" USING btree ("recipient_user_id","type","message_id") WHERE "notifications"."message_id" is not null;--> statement-breakpoint
-- Adopt pre-existing investor -> startup interests into the new request model
-- so an already-accepted interest can get a conversation without touching the
-- legacy rows (which stay the source of truth for the old dashboard counters).
INSERT INTO "connection_requests" ("sender_user_id", "recipient_user_id", "pair_key", "message", "status", "created_at", "updated_at", "responded_at")
SELECT
  iu."id",
  su."id",
  least(iu."id"::text, su."id"::text) || ':' || greatest(iu."id"::text, su."id"::text),
  i."message",
  CASE i."status" WHEN 'accepted' THEN 'accepted' WHEN 'declined' THEN 'rejected' ELSE 'pending' END,
  COALESCE(i."created_at", now()),
  COALESCE(i."created_at", now()),
  CASE WHEN i."status" IN ('accepted', 'declined') THEN COALESCE(i."created_at", now()) ELSE NULL END
FROM "interests" i
JOIN "investors" inv ON inv."id" = i."investor_id"
JOIN "startups" st ON st."id" = i."startup_id"
JOIN "users" iu ON iu."id" = inv."user_id"
JOIN "users" su ON su."id" = st."user_id"
WHERE iu."id" <> su."id"
ON CONFLICT ("pair_key") DO NOTHING;