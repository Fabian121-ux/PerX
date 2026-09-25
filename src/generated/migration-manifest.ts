/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Regenerate with `npm run migrations:manifest`. CI re-runs the generator and
 * fails if the result differs from this file, so edits here will be reverted
 * by the next regeneration.
 *
 * Source of truth: `prisma/migrations/`.
 *
 * This is the set of migrations this build expects its database to have
 * applied. `src/lib/db/migration-drift.ts` compares it against the rows in
 * `_prisma_migrations` at runtime, because the running application is the
 * only place that holds both numbers. CI cannot do this: it has no Production
 * credentials and must never be given any.
 */
export const MIGRATION_MANIFEST: readonly string[] = [
  "0001_init",
  "0002_open_beta_registration",
  "20260722122447_network_and_support_beta",
  "20260722135700_add_internal_tester_role",
  "20260723184500_people_profiles_connections_manage",
  "20260726143000_content_visibility_notifications_real_estate",
  "20260726161000_actionable_notifications_messaging_presence_broadcasts",
  "20260727113000_message_replies_and_exact_notification_destinations",
  "20260727170000_user_reports",
  "20260727192900_add_master_admin_role_enum",
  "20260727193000_moderation_enforcement_home_messaging",
  "20260731120000_add_product_opportunity_type",
  "20260731130000_add_sponsored_content",
  "20260802120000_messaging_deal_versions_payment_readiness",
  "20260808150000_message_mutation_polling_index",
  "20260824120000_messaging_realtime_publication",
  "20260825120000_messaging_realtime_admin_grant",
  "20260825151826_password_reset_tokens",
  "20260827150000_trader_applications",
  "20260924160000_add_supabase_auth_user_link",
];
