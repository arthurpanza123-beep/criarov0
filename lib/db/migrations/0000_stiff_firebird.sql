CREATE TYPE "public"."credit_ledger_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_type" AS ENUM('earned', 'spent', 'adjustment', 'expired', 'sale');--> statement-breakpoint
CREATE TYPE "public"."managed_account_status" AS ENUM('active', 'inactive', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'pending_payment', 'paid', 'processing', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'invited', 'accessed', 'registered', 'awaiting_approval', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"referral_url" text,
	"reward_per_conversion" numeric(14, 2) DEFAULT '0' NOT NULL,
	"monthly_limit" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"terms_url" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_reward_non_negative_chk" CHECK ("campaigns"."reward_per_conversion" >= 0),
	CONSTRAINT "campaigns_monthly_limit_non_negative_chk" CHECK ("campaigns"."monthly_limit" is null or "campaigns"."monthly_limit" >= 0),
	CONSTRAINT "campaigns_currency_length_chk" CHECK (char_length("campaigns"."currency") between 3 and 8)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"managed_account_id" uuid NOT NULL,
	"campaign_id" uuid,
	"referral_id" uuid,
	"type" "credit_ledger_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "credit_ledger_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_currency_length_chk" CHECK (char_length("credit_ledger"."currency") between 3 and 8)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_lower_chk" CHECK ("customers"."email" is null or "customers"."email" = lower("customers"."email"))
);
--> statement-breakpoint
CREATE TABLE "managed_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"email" text NOT NULL,
	"provider" text NOT NULL,
	"status" "managed_account_status" DEFAULT 'active' NOT NULL,
	"credit_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"monthly_credit_limit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"last_checked_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_accounts_email_lower_chk" CHECK ("managed_accounts"."email" = lower("managed_accounts"."email")),
	CONSTRAINT "managed_accounts_credit_balance_non_negative_chk" CHECK ("managed_accounts"."credit_balance" >= 0),
	CONSTRAINT "managed_accounts_monthly_limit_non_negative_chk" CHECK ("managed_accounts"."monthly_credit_limit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" DEFAULT 'info' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"description" text NOT NULL,
	"credit_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sale_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cost_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_credit_amount_non_negative_chk" CHECK ("orders"."credit_amount" >= 0),
	CONSTRAINT "orders_sale_price_non_negative_chk" CHECK ("orders"."sale_price" >= 0),
	CONSTRAINT "orders_cost_price_non_negative_chk" CHECK ("orders"."cost_price" >= 0),
	CONSTRAINT "orders_currency_length_chk" CHECK (char_length("orders"."currency") between 3 and 8)
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"expected_reward" numeric(14, 2) DEFAULT '0' NOT NULL,
	"approved_reward" numeric(14, 2),
	"invited_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_contact_email_lower_chk" CHECK ("referrals"."contact_email" is null or "referrals"."contact_email" = lower("referrals"."contact_email")),
	CONSTRAINT "referrals_expected_reward_non_negative_chk" CHECK ("referrals"."expected_reward" >= 0),
	CONSTRAINT "referrals_approved_reward_non_negative_chk" CHECK ("referrals"."approved_reward" is null or "referrals"."approved_reward" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_managed_account_id_managed_accounts_id_fk" FOREIGN KEY ("managed_account_id") REFERENCES "public"."managed_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "activities_entity_idx" ON "activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "campaigns_platform_idx" ON "campaigns" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "campaigns_active_idx" ON "campaigns" USING btree ("active");--> statement-breakpoint
CREATE INDEX "credit_ledger_managed_account_id_idx" ON "credit_ledger" USING btree ("managed_account_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_occurred_at_idx" ON "credit_ledger" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_type_status_idx" ON "credit_ledger" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_archived_at_idx" ON "customers" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "managed_accounts_status_idx" ON "managed_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "managed_accounts_provider_idx" ON "managed_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "managed_accounts_archived_at_idx" ON "managed_accounts" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "referrals_campaign_id_idx" ON "referrals" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "referrals_created_at_idx" ON "referrals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_key_unique_idx" ON "settings" USING btree ("key");