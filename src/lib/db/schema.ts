import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  date,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["worker", "recruiter"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "incomplete",
  "trialing",
]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "top_talent_unlock",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const verificationDecisionEnum = pgEnum("verification_decision", [
  "pending_submitted",
  "approved",
  "rejected",
  "revoked",
]);

export const verificationMethodEnum = pgEnum("verification_method", [
  "manual_id_review",
  "system",
]);

export const docTypeEnum = pgEnum("doc_type", [
  "passport",
  "thai_id",
  "drivers_license",
  "other",
]);

export const photoModerationStatusEnum = pgEnum("photo_moderation_status", [
  "pending",
  "approved",
  "rejected",
]);

export const hireOutcomeStatusEnum = pgEnum("hire_outcome_status", [
  "interested",
  "hired",
  "started",
]);

export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "queued",
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "closed",
  "blocked",
]);

export const messageKindEnum = pgEnum("message_kind", [
  "text",
  "system",
  "contact_share",
]);

export const flagTargetEnum = pgEnum("flag_target", [
  "message",
  "contact_request",
  "blocked_attempt",
]);

export const flagStatusEnum = pgEnum("flag_status", [
  "open",
  "dismissed",
  "actioned",
]);

export const contactShareChannelEnum = pgEnum("contact_share_channel", [
  "line",
  "phone",
  "whatsapp",
]);

export const hireConfirmationRequestedStatusEnum = pgEnum(
  "hire_confirmation_requested_status",
  ["hired", "started"]
);

export const hireConfirmationRequestStatusEnum = pgEnum(
  "hire_confirmation_request_status",
  ["pending", "confirmed", "rejected", "cancelled"]
);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
  "banned",
]);

export const billingAccessModeEnum = pgEnum("billing_access_mode", [
  "enforced",
  "open_access",
]);

export const billingProductEnum = pgEnum("billing_product", [
  "monthly",
  "annual",
  "pass_7d",
]);

export const adminEntitlementKindEnum = pgEnum("admin_entitlement_kind", [
  "top_talent_unlock",
]);

export const workerExpectedPayPeriodEnum = pgEnum(
  "worker_expected_pay_period",
  ["day", "month"]
);

export const venueLinkKindEnum = pgEnum("venue_link_kind", [
  "google_maps",
  "facebook",
  "instagram",
]);

export const venueReviewStatusEnum = pgEnum("venue_review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const adminAuditActionEnum = pgEnum("admin_audit_action", [
  "account_suspended",
  "account_reactivated",
  "account_banned",
  "ban_lifted",
  "admin_premium_granted",
  "admin_premium_extended",
  "lifetime_premium_granted",
  "admin_premium_revoked",
  "subscription_paywall_mode_changed",
  "billing_prices_changed",
  "messaging_settings_changed",
  "identity_verification_approved",
  "identity_verification_rejected",
  "identity_verification_revoked",
  "recruiter_verification_approved",
  "recruiter_verification_rejected",
  "recruiter_verification_revoked",
  "venue_approved",
  "venue_rejected",
  "photo_approved",
  "photo_rejected",
  "report_resolved",
  "message_flag_reviewed",
  "recruiter_messaging_paused",
  "recruiter_messaging_unpaused",
  "conversation_viewed",
]);

export const reportReasonEnum = pgEnum("report_reason", [
  "scam_or_fake_job",
  "asked_for_money",
  "asked_for_documents",
  "harassment",
  "sexual_content",
  "underage_concern",
  "trafficking_concern",
  "spam",
  "other",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "reviewing",
  "actioned",
  "dismissed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "contact_request_received",
  "contact_request_accepted",
  "contact_request_declined",
  "new_message",
  "contact_shared",
  "verification_approved",
  "verification_rejected",
  "venue_approved",
  "venue_rejected",
  "messaging_paused",
  "safety_notice",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "skipped",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    name: text("name"),
    image: text("image"),
    role: userRoleEnum("role").notNull(),
    ageVerified: boolean("age_verified").notNull().default(false),
    dateOfBirth: date("date_of_birth"),
    ageVerifiedAt: timestamp("age_verified_at", { mode: "date" }),
    accountStatus: accountStatusEnum("account_status")
      .notNull()
      .default("active"),
    accountStatusReason: text("account_status_reason"),
    accountStatusChangedAt: timestamp("account_status_changed_at", {
      mode: "date",
    }),
    accountStatusChangedBy: text("account_status_changed_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_account_status_idx").on(table.accountStatus),
  ]
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_idx").on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: text("session_token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("verification_tokens_identifier_token_idx").on(
      table.identifier,
      table.token
    ),
  ]
);

export const workerProfiles = pgTable(
  "worker_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    photoKey: text("photo_key"),
    photoUrl: text("photo_url"),
    displayName: text("display_name").notNull(),
    location: text("location"),
    area: text("area"),
    description: text("description"),
    bio: text("bio"),
    availability: jsonb("availability").$type<string[]>().notNull().default([]),
    /** Single expected-pay amount (legacy column name kept). */
    expectedPayMin: integer("expected_pay_min"),
    /** @deprecated Legacy range max; no longer written. */
    expectedPayMax: integer("expected_pay_max"),
    expectedPayPeriod: workerExpectedPayPeriodEnum("expected_pay_period"),
    payCurrency: text("pay_currency").default("THB"),
    jobRoles: jsonb("job_roles").$type<string[]>().default([]),
    experience: text("experience"),
    experienceYears: integer("experience_years"),
    languages: jsonb("languages").$type<string[]>().default([]),
    lineId: text("line_id"),
    whatsappNumber: text("whatsapp_number"),
    phoneNumber: text("phone_number"),
    isPublished: boolean("is_published").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    idDocumentKey: text("id_document_key"),
    livenessVideoKey: text("liveness_video_key"),
    challengeCode: text("challenge_code"),
    challengeIssuedAt: timestamp("challenge_issued_at", { mode: "date" }),
    idDocumentSubmittedAt: timestamp("id_document_submitted_at", {
      mode: "date",
    }),
    verificationReviewedAt: timestamp("verification_reviewed_at", {
      mode: "date",
    }),
    verificationReviewedBy: text("verification_reviewed_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("worker_profiles_user_id_idx").on(table.userId),
    index("worker_profiles_area_idx").on(table.area),
    index("worker_profiles_is_published_idx").on(table.isPublished),
    index("worker_profiles_verification_status_idx").on(
      table.verificationStatus
    ),
  ]
);

export const profilePhotos = pgTable(
  "profile_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    stagingKey: text("staging_key"),
    photoKey: text("photo_key"),
    photoUrl: text("photo_url"),
    moderationStatus: photoModerationStatusEnum("moderation_status")
      .notNull()
      .default("pending"),
    moderationReason: text("moderation_reason"),
    moderationConfidence: integer("moderation_confidence"),
    moderationCategories: jsonb("moderation_categories").$type<string[]>(),
    moderationReviewedAt: timestamp("moderation_reviewed_at", { mode: "date" }),
    moderationReviewedBy: text("moderation_reviewed_by"),
    displayOrder: integer("display_order").notNull().default(0),
    isCurrentApproved: boolean("is_current_approved").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("profile_photos_user_id_idx").on(table.userId),
    index("profile_photos_worker_profile_id_idx").on(table.workerProfileId),
    index("profile_photos_moderation_status_idx").on(table.moderationStatus),
    index("profile_photos_is_current_approved_idx").on(table.isCurrentApproved),
  ]
);

export const recruiterProfiles = pgTable(
  "recruiter_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationName: text("organization_name"),
    organizationType: text("organization_type"),
    website: text("website"),
    description: text("description"),
    location: text("location"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    lineId: text("line_id"),
    logoKey: text("logo_key"),
    logoUrl: text("logo_url"),
    area: text("area"),
    subArea: text("sub_area"),
    blurb: text("blurb"),
    isVerified: boolean("is_verified").notNull().default(false),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    idDocumentKey: text("id_document_key"),
    livenessVideoKey: text("liveness_video_key"),
    challengeCode: text("challenge_code"),
    challengeIssuedAt: timestamp("challenge_issued_at", { mode: "date" }),
    idDocumentSubmittedAt: timestamp("id_document_submitted_at", {
      mode: "date",
    }),
    verificationReviewedAt: timestamp("verification_reviewed_at", {
      mode: "date",
    }),
    verificationReviewedBy: text("verification_reviewed_by"),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    messagingPausedAt: timestamp("messaging_paused_at", { mode: "date" }),
    messagingPausedReason: text("messaging_paused_reason"),
    messagingPausedBy: text("messaging_paused_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("recruiter_profiles_user_id_idx").on(table.userId),
    index("recruiter_profiles_area_idx").on(table.area),
    index("recruiter_profiles_verification_status_idx").on(
      table.verificationStatus
    ),
  ]
);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterProfileId: uuid("recruiter_profile_id")
      .notNull()
      .references(() => recruiterProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    venueType: text("venue_type"),
    area: text("area"),
    subArea: text("sub_area"),
    blurb: text("blurb"),
    logoKey: text("logo_key"),
    logoUrl: text("logo_url"),
    venueLinkUrl: text("venue_link_url").notNull(),
    venueLinkKind: venueLinkKindEnum("venue_link_kind").notNull(),
    reviewStatus: venueReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    reviewedBy: text("reviewed_by"),
    isPrimary: boolean("is_primary").notNull().default(false),
    businessDocKey: text("business_doc_key"),
    businessVerifiedAt: timestamp("business_verified_at", { mode: "date" }),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("venues_recruiter_profile_id_idx").on(table.recruiterProfileId),
    index("venues_review_status_idx").on(table.reviewStatus),
    uniqueIndex("venues_one_primary_per_recruiter_uidx")
      .on(table.recruiterProfileId)
      .where(sql`${table.isPrimary} = true`),
  ]
);

export const recruiterOpenings = pgTable(
  "recruiter_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterProfileId: uuid("recruiter_profile_id")
      .notNull()
      .references(() => recruiterProfiles.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").references(() => venues.id, {
      onDelete: "set null",
    }),
    role: text("role").notNull(),
    area: text("area").notNull(),
    payMin: integer("pay_min"),
    payMax: integer("pay_max"),
    payCurrency: text("pay_currency").notNull().default("THB"),
    payPeriod: text("pay_period").notNull().default("night"),
    notes: text("notes"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("recruiter_openings_recruiter_profile_id_idx").on(
      table.recruiterProfileId
    ),
    index("recruiter_openings_venue_id_idx").on(table.venueId),
    index("recruiter_openings_area_idx").on(table.area),
    index("recruiter_openings_is_published_idx").on(table.isPublished),
  ]
);

export const profileViews = pgTable(
  "profile_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerIpHash: text("viewer_ip_hash"),
    viewedAt: timestamp("viewed_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("profile_views_worker_profile_id_idx").on(table.workerProfileId),
    index("profile_views_viewed_at_idx").on(table.viewedAt),
  ]
);

export const profileInterests = pgTable(
  "profile_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterUserId: uuid("recruiter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    openingId: uuid("opening_id").references(() => recruiterOpenings.id, {
      onDelete: "set null",
    }),
    message: text("message"),
    notifiedAt: timestamp("notified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("profile_interests_recruiter_idx").on(table.recruiterUserId),
    index("profile_interests_worker_idx").on(table.workerProfileId),
    index("profile_interests_opening_idx").on(table.openingId),
    uniqueIndex("profile_interests_unique_idx").on(
      table.recruiterUserId,
      table.workerProfileId
    ),
  ]
);

export const contactRequests = pgTable(
  "contact_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterUserId: uuid("recruiter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recruiterProfileId: uuid("recruiter_profile_id")
      .notNull()
      .references(() => recruiterProfiles.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").references(() => venues.id, {
      onDelete: "set null",
    }),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    openingId: uuid("opening_id").references(() => recruiterOpenings.id, {
      onDelete: "set null",
    }),
    openerText: text("opener_text").notNull(),
    followUpText: text("follow_up_text"),
    followUpSentAt: timestamp("follow_up_sent_at", { mode: "date" }),
    status: contactRequestStatusEnum("status").notNull().default("pending"),
    isPro: boolean("is_pro").notNull().default(false),
    isTopTalentTarget: boolean("is_top_talent_target").notNull().default(false),
    countsTowardCaps: boolean("counts_toward_caps").notNull().default(true),
    isFlagged: boolean("is_flagged").notNull().default(false),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    respondedAt: timestamp("responded_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    workerHiddenAt: timestamp("worker_hidden_at", { mode: "date" }),
    legacyInterestId: uuid("legacy_interest_id").unique(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_requests_recruiter_created_idx").on(
      table.recruiterUserId,
      table.createdAt
    ),
    index("contact_requests_worker_status_delivered_idx").on(
      table.workerProfileId,
      table.status,
      table.deliveredAt
    ),
    index("contact_requests_status_expires_idx").on(
      table.status,
      table.expiresAt
    ),
    uniqueIndex("contact_requests_open_pair_uidx")
      .on(table.recruiterUserId, table.workerProfileId)
      .where(sql`${table.status} IN ('queued', 'pending', 'accepted')`),
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactRequestId: uuid("contact_request_id")
      .notNull()
      .unique()
      .references(() => contactRequests.id, { onDelete: "cascade" }),
    recruiterUserId: uuid("recruiter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerProfileId: uuid("worker_profile_id")
      .notNull()
      .references(() => workerProfiles.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").references(() => venues.id, {
      onDelete: "set null",
    }),
    status: conversationStatusEnum("status").notNull().default("open"),
    lastMessageAt: timestamp("last_message_at", { mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    retentionExpiresAt: timestamp("retention_expires_at", { mode: "date" }),
    legalHoldUntil: timestamp("legal_hold_until", { mode: "date" }),
    workerHiddenAt: timestamp("worker_hidden_at", { mode: "date" }),
    recruiterHiddenAt: timestamp("recruiter_hidden_at", { mode: "date" }),
    workerLastReadAt: timestamp("worker_last_read_at", { mode: "date" }),
    recruiterLastReadAt: timestamp("recruiter_last_read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("conversations_worker_last_message_idx").on(
      table.workerUserId,
      table.lastMessageAt
    ),
    index("conversations_recruiter_last_message_idx").on(
      table.recruiterUserId,
      table.lastMessageAt
    ),
    index("conversations_retention_expires_idx").on(table.retentionExpiresAt),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: messageKindEnum("kind").notNull().default("text"),
    body: text("body").notNull(),
    isFlagged: boolean("is_flagged").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

export const messageFlags = pgTable(
  "message_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: flagTargetEnum("target_type").notNull(),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    contactRequestId: uuid("contact_request_id").references(
      () => contactRequests.id,
      { onDelete: "cascade" }
    ),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    categories: jsonb("categories").$type<string[]>().notNull(),
    matchedTerms: jsonb("matched_terms").$type<string[]>().notNull(),
    excerpt: text("excerpt"),
    status: flagStatusEnum("status").notNull().default("open"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("message_flags_status_created_idx").on(table.status, table.createdAt),
    index("message_flags_author_user_id_idx").on(table.authorUserId),
  ]
);

export const contactShares = pgTable(
  "contact_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    sharerUserId: uuid("sharer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: contactShareChannelEnum("channel").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("contact_shares_conversation_idx").on(table.conversationId)]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reportedUserId: uuid("reported_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactRequestId: uuid("contact_request_id").references(
      () => contactRequests.id,
      { onDelete: "set null" }
    ),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    evidenceSnapshot: jsonb("evidence_snapshot").$type<Record<string, unknown>>(),
    status: reportStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_status_created_idx").on(table.status, table.createdAt),
    index("reports_reported_user_created_idx").on(
      table.reportedUserId,
      table.createdAt
    ),
  ]
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_blocks_blocker_blocked_uidx").on(
      table.blockerUserId,
      table.blockedUserId
    ),
    index("user_blocks_blocked_user_id_idx").on(table.blockedUserId),
  ]
);

export const userNotificationPrefs = pgTable("user_notification_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  lineEnabled: boolean("line_enabled").notNull().default(true),
  locale: text("locale").notNull().default("th"),
  inboundDailyLimit: integer("inbound_daily_limit"),
  inboundPaused: boolean("inbound_paused").notNull().default(false),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, string>>().notNull(),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at", { mode: "date" }),
    emailStatus: deliveryStatusEnum("email_status")
      .notNull()
      .default("pending"),
    lineStatus: deliveryStatusEnum("line_status")
      .notNull()
      .default("pending"),
    emailSentAt: timestamp("email_sent_at", { mode: "date" }),
    lineSentAt: timestamp("line_sent_at", { mode: "date" }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt
    ),
    index("notifications_delivery_created_idx").on(
      table.emailStatus,
      table.lineStatus,
      table.createdAt
    ),
  ]
);

export const hireOutcomes = pgTable(
  "hire_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interestId: uuid("interest_id")
      .notNull()
      .unique()
      .references(() => profileInterests.id, { onDelete: "cascade" }),
    contactRequestId: uuid("contact_request_id").references(
      () => contactRequests.id,
      { onDelete: "set null" }
    ),
    status: hireOutcomeStatusEnum("status").notNull().default("interested"),
    hiredAt: timestamp("hired_at", { mode: "date" }),
    startedAt: timestamp("started_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("hire_outcomes_interest_id_idx").on(table.interestId),
    index("hire_outcomes_contact_request_id_idx").on(table.contactRequestId),
    index("hire_outcomes_status_idx").on(table.status),
  ]
);

export const hireOutcomeConfirmationRequests = pgTable(
  "hire_outcome_confirmation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interestId: uuid("interest_id")
      .notNull()
      .references(() => profileInterests.id, { onDelete: "cascade" }),
    contactRequestId: uuid("contact_request_id").references(
      () => contactRequests.id,
      { onDelete: "cascade" }
    ),
    requestedStatus: hireConfirmationRequestedStatusEnum("requested_status").notNull(),
    requestStatus: hireConfirmationRequestStatusEnum("request_status")
      .notNull()
      .default("pending"),
    requestedByRecruiterUserId: uuid("requested_by_recruiter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedAt: timestamp("requested_at", { mode: "date" }).notNull().defaultNow(),
    respondedByWorkerUserId: uuid("responded_by_worker_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    respondedAt: timestamp("responded_at", { mode: "date" }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("hire_conf_req_interest_id_idx").on(table.interestId),
    index("hire_conf_req_contact_request_id_idx").on(table.contactRequestId),
    index("hire_conf_req_request_status_idx").on(table.requestStatus),
    index("hire_conf_req_requested_by_idx").on(table.requestedByRecruiterUserId),
    index("hire_conf_req_pending_requested_at_idx").on(
      table.requestStatus,
      table.requestedAt
    ),
    uniqueIndex("hire_conf_req_one_pending_per_interest_uidx")
      .on(table.interestId)
      .where(sql`${table.requestStatus} = 'pending'`),
  ]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripePriceId: text("stripe_price_id"),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    plan: subscriptionPlanEnum("plan").notNull().default("free"),
    billingProduct: billingProductEnum("billing_product"),
    launchDiscountApplied: boolean("launch_discount_applied")
      .notNull()
      .default(false),
    currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
  ]
);

export const BILLING_PRICE_SETTINGS_ID = "default";

export const billingPriceSettings = pgTable("billing_price_settings", {
  id: text("id").primaryKey(),
  monthlyPriceId: text("monthly_price_id"),
  annualPriceId: text("annual_price_id"),
  pass7dPriceId: text("pass_7d_price_id"),
  launchCouponId: text("launch_coupon_id"),
  launchEnabled: boolean("launch_enabled").notNull().default(false),
  launchSeatsLimit: integer("launch_seats_limit").notNull().default(50),
  firstPassCouponId: text("first_pass_coupon_id"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export const MESSAGING_SETTINGS_ID = "default";

export const messagingSettings = pgTable("messaging_settings", {
  id: text("id").primaryKey(),
  freeDailyNew: integer("free_daily_new").notNull().default(3),
  freeWeeklyNew: integer("free_weekly_new").notNull().default(10),
  freePendingMax: integer("free_pending_max").notNull().default(5),
  freeOpenerMaxChars: integer("free_opener_max_chars").notNull().default(300),
  freeCanAttachOpening: boolean("free_can_attach_opening")
    .notNull()
    .default(false),
  freeMaxVenues: integer("free_max_venues").notNull().default(1),
  paidDailyNew: integer("paid_daily_new").notNull().default(20),
  paidWeeklyNew: integer("paid_weekly_new").notNull().default(100),
  paidDailyTopTalent: integer("paid_daily_top_talent").notNull().default(10),
  paidPendingMax: integer("paid_pending_max").notNull().default(25),
  paidOpenerMaxChars: integer("paid_opener_max_chars").notNull().default(1000),
  paidMaxVenues: integer("paid_max_venues").notNull().default(5),
  newRecruiterDailyCap: integer("new_recruiter_daily_cap").notNull().default(5),
  newRecruiterWindowDays: integer("new_recruiter_window_days")
    .notNull()
    .default(7),
  workerInboundDailyDefault: integer("worker_inbound_daily_default")
    .notNull()
    .default(10),
  followUpAfterHours: integer("follow_up_after_hours").notNull().default(48),
  requestExpiryDays: integer("request_expiry_days").notNull().default(14),
  declineCooldownDays: integer("decline_cooldown_days").notNull().default(30),
  messageMaxChars: integer("message_max_chars").notNull().default(2000),
  autoPauseReportThreshold: integer("auto_pause_report_threshold")
    .notNull()
    .default(3),
  autoPauseWindowDays: integer("auto_pause_window_days").notNull().default(30),
  notifyCooldownMinutes: integer("notify_cooldown_minutes")
    .notNull()
    .default(15),
  lineMonthlyPushBudget: integer("line_monthly_push_budget")
    .notNull()
    .default(300),
  retentionDays: integer("retention_days").notNull().default(180),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export const topTalentPasses = pgTable(
  "top_talent_passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id")
      .notNull()
      .unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountTotal: integer("amount_total"),
    currency: text("currency"),
    usedFirstPassCoupon: boolean("used_first_pass_coupon")
      .notNull()
      .default(false),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("top_talent_passes_user_expires_idx").on(
      table.userId,
      table.expiresAt
    ),
  ]
);

export const verificationEvents = pgTable(
  "verification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerProfileId: uuid("worker_profile_id").references(
      () => workerProfiles.id,
      { onDelete: "set null" }
    ),
    recruiterProfileId: uuid("recruiter_profile_id").references(
      () => recruiterProfiles.id,
      { onDelete: "set null" }
    ),
    decision: verificationDecisionEnum("decision").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorType: text("actor_type").notNull().default("admin"),
    method: verificationMethodEnum("method").notNull(),
    docType: docTypeEnum("doc_type"),
    idDocumentKey: text("id_document_key"),
    idDocumentSha256: text("id_document_sha256"),
    livenessVideoKey: text("liveness_video_key"),
    livenessVideoSha256: text("liveness_video_sha256"),
    challengeCode: text("challenge_code"),
    last4: text("last4"),
    issuingCountry: text("issuing_country"),
    notes: text("notes"),
    retentionExpiresAt: timestamp("retention_expires_at", { mode: "date" }),
    idDocumentDeletedAt: timestamp("id_document_deleted_at", { mode: "date" }),
    livenessVideoDeletedAt: timestamp("liveness_video_deleted_at", {
      mode: "date",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("verification_events_user_id_idx").on(table.userId),
    index("verification_events_worker_profile_id_idx").on(
      table.workerProfileId
    ),
    index("verification_events_recruiter_profile_id_idx").on(
      table.recruiterProfileId
    ),
    index("verification_events_decision_idx").on(table.decision),
    index("verification_events_created_at_idx").on(table.createdAt),
    index("verification_events_retention_expires_idx").on(
      table.retentionExpiresAt
    ),
  ]
);

export const PLATFORM_SETTINGS_ID = "default";

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  billingAccessMode: billingAccessModeEnum("billing_access_mode")
    .notNull()
    .default("enforced"),
  billingAccessModeReason: text("billing_access_mode_reason"),
  billingAccessModeUpdatedAt: timestamp("billing_access_mode_updated_at", {
    mode: "date",
  }),
  billingAccessModeUpdatedBy: text("billing_access_mode_updated_by"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const bannedIdentities = pgTable(
  "banned_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    normalizedEmail: text("normalized_email").notNull(),
    originalUserId: uuid("original_user_id"),
    reason: text("reason").notNull(),
    bannedAt: timestamp("banned_at", { mode: "date" }).notNull().defaultNow(),
    bannedByAdminEmail: text("banned_by_admin_email").notNull(),
    liftedAt: timestamp("lifted_at", { mode: "date" }),
    liftedByAdminEmail: text("lifted_by_admin_email"),
  },
  (table) => [
    index("banned_identities_normalized_email_idx").on(table.normalizedEmail),
    uniqueIndex("banned_identities_active_email_uidx")
      .on(table.normalizedEmail)
      .where(sql`${table.liftedAt} IS NULL`),
  ]
);

export const adminEntitlements = pgTable(
  "admin_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: adminEntitlementKindEnum("kind")
      .notNull()
      .default("top_talent_unlock"),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    isLifetime: boolean("is_lifetime").notNull().default(false),
    reason: text("reason").notNull(),
    grantedByAdminEmail: text("granted_by_admin_email").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    revokedByAdminEmail: text("revoked_by_admin_email"),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    index("admin_entitlements_user_id_idx").on(table.userId),
    uniqueIndex("admin_entitlements_active_user_kind_uidx")
      .on(table.userId, table.kind)
      .where(sql`${table.revokedAt} IS NULL`),
  ]
);

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: adminAuditActionEnum("action").notNull(),
    actorAdminEmail: text("actor_admin_email").notNull(),
    actorUserId: uuid("actor_user_id"),
    targetUserId: uuid("target_user_id"),
    targetIdentity: text("target_identity"),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_events_created_at_idx").on(table.createdAt),
    index("admin_audit_events_action_idx").on(table.action),
    index("admin_audit_events_target_user_id_idx").on(table.targetUserId),
  ]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  workerProfile: one(workerProfiles, {
    fields: [users.id],
    references: [workerProfiles.userId],
  }),
  recruiterProfile: one(recruiterProfiles, {
    fields: [users.id],
    references: [recruiterProfiles.userId],
  }),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  sentInterests: many(profileInterests),
  sentContactRequests: many(contactRequests, {
    relationName: "contactRequestRecruiter",
  }),
  receivedContactRequests: many(contactRequests, {
    relationName: "contactRequestWorker",
  }),
  notificationPrefs: one(userNotificationPrefs, {
    fields: [users.id],
    references: [userNotificationPrefs.userId],
  }),
  notifications: many(notifications),
  adminEntitlements: many(adminEntitlements),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const workerProfilesRelations = relations(
  workerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workerProfiles.userId],
      references: [users.id],
    }),
    views: many(profileViews),
    interests: many(profileInterests),
    contactRequests: many(contactRequests),
    photos: many(profilePhotos),
  })
);

export const profilePhotosRelations = relations(profilePhotos, ({ one }) => ({
  user: one(users, {
    fields: [profilePhotos.userId],
    references: [users.id],
  }),
  workerProfile: one(workerProfiles, {
    fields: [profilePhotos.workerProfileId],
    references: [workerProfiles.id],
  }),
}));

export const recruiterProfilesRelations = relations(
  recruiterProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [recruiterProfiles.userId],
      references: [users.id],
    }),
    openings: many(recruiterOpenings),
    venues: many(venues),
  })
);

export const venuesRelations = relations(venues, ({ one, many }) => ({
  recruiterProfile: one(recruiterProfiles, {
    fields: [venues.recruiterProfileId],
    references: [recruiterProfiles.id],
  }),
  openings: many(recruiterOpenings),
}));

export const recruiterOpeningsRelations = relations(
  recruiterOpenings,
  ({ one, many }) => ({
    recruiterProfile: one(recruiterProfiles, {
      fields: [recruiterOpenings.recruiterProfileId],
      references: [recruiterProfiles.id],
    }),
    venue: one(venues, {
      fields: [recruiterOpenings.venueId],
      references: [venues.id],
    }),
    interests: many(profileInterests),
  })
);

export const profileViewsRelations = relations(profileViews, ({ one }) => ({
  workerProfile: one(workerProfiles, {
    fields: [profileViews.workerProfileId],
    references: [workerProfiles.id],
  }),
  viewer: one(users, {
    fields: [profileViews.viewerUserId],
    references: [users.id],
  }),
}));

export const profileInterestsRelations = relations(
  profileInterests,
  ({ one, many }) => ({
    recruiter: one(users, {
      fields: [profileInterests.recruiterUserId],
      references: [users.id],
    }),
    workerProfile: one(workerProfiles, {
      fields: [profileInterests.workerProfileId],
      references: [workerProfiles.id],
    }),
    opening: one(recruiterOpenings, {
      fields: [profileInterests.openingId],
      references: [recruiterOpenings.id],
    }),
    hireOutcome: one(hireOutcomes, {
      fields: [profileInterests.id],
      references: [hireOutcomes.interestId],
    }),
    confirmationRequests: many(hireOutcomeConfirmationRequests),
  })
);

export const contactRequestsRelations = relations(
  contactRequests,
  ({ one }) => ({
    recruiter: one(users, {
      fields: [contactRequests.recruiterUserId],
      references: [users.id],
      relationName: "contactRequestRecruiter",
    }),
    worker: one(users, {
      fields: [contactRequests.workerUserId],
      references: [users.id],
      relationName: "contactRequestWorker",
    }),
    recruiterProfile: one(recruiterProfiles, {
      fields: [contactRequests.recruiterProfileId],
      references: [recruiterProfiles.id],
    }),
    workerProfile: one(workerProfiles, {
      fields: [contactRequests.workerProfileId],
      references: [workerProfiles.id],
    }),
    venue: one(venues, {
      fields: [contactRequests.venueId],
      references: [venues.id],
    }),
    opening: one(recruiterOpenings, {
      fields: [contactRequests.openingId],
      references: [recruiterOpenings.id],
    }),
    conversation: one(conversations, {
      fields: [contactRequests.id],
      references: [conversations.contactRequestId],
    }),
  })
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contactRequest: one(contactRequests, {
    fields: [conversations.contactRequestId],
    references: [contactRequests.id],
  }),
  recruiter: one(users, {
    fields: [conversations.recruiterUserId],
    references: [users.id],
    relationName: "conversationRecruiter",
  }),
  worker: one(users, {
    fields: [conversations.workerUserId],
    references: [users.id],
    relationName: "conversationWorker",
  }),
  workerProfile: one(workerProfiles, {
    fields: [conversations.workerProfileId],
    references: [workerProfiles.id],
  }),
  venue: one(venues, {
    fields: [conversations.venueId],
    references: [venues.id],
  }),
  messages: many(messages),
  messageFlags: many(messageFlags),
  contactShares: many(contactShares),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderUserId],
    references: [users.id],
  }),
}));

export const messageFlagsRelations = relations(messageFlags, ({ one }) => ({
  message: one(messages, {
    fields: [messageFlags.messageId],
    references: [messages.id],
  }),
  contactRequest: one(contactRequests, {
    fields: [messageFlags.contactRequestId],
    references: [contactRequests.id],
  }),
  conversation: one(conversations, {
    fields: [messageFlags.conversationId],
    references: [conversations.id],
  }),
  author: one(users, {
    fields: [messageFlags.authorUserId],
    references: [users.id],
  }),
}));

export const contactSharesRelations = relations(contactShares, ({ one }) => ({
  conversation: one(conversations, {
    fields: [contactShares.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [contactShares.messageId],
    references: [messages.id],
  }),
  sharer: one(users, {
    fields: [contactShares.sharerUserId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [contactShares.recipientUserId],
    references: [users.id],
  }),
}));

export const userNotificationPrefsRelations = relations(
  userNotificationPrefs,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotificationPrefs.userId],
      references: [users.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const hireOutcomesRelations = relations(hireOutcomes, ({ one }) => ({
  interest: one(profileInterests, {
    fields: [hireOutcomes.interestId],
    references: [profileInterests.id],
  }),
  contactRequest: one(contactRequests, {
    fields: [hireOutcomes.contactRequestId],
    references: [contactRequests.id],
  }),
}));

export const hireOutcomeConfirmationRequestsRelations = relations(
  hireOutcomeConfirmationRequests,
  ({ one }) => ({
    interest: one(profileInterests, {
      fields: [hireOutcomeConfirmationRequests.interestId],
      references: [profileInterests.id],
    }),
    contactRequest: one(contactRequests, {
      fields: [hireOutcomeConfirmationRequests.contactRequestId],
      references: [contactRequests.id],
    }),
    requestedByRecruiter: one(users, {
      fields: [hireOutcomeConfirmationRequests.requestedByRecruiterUserId],
      references: [users.id],
    }),
    respondedByWorker: one(users, {
      fields: [hireOutcomeConfirmationRequests.respondedByWorkerUserId],
      references: [users.id],
    }),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const adminEntitlementsRelations = relations(
  adminEntitlements,
  ({ one }) => ({
    user: one(users, {
      fields: [adminEntitlements.userId],
      references: [users.id],
    }),
  })
);

export const verificationEventsRelations = relations(
  verificationEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [verificationEvents.userId],
      references: [users.id],
    }),
    workerProfile: one(workerProfiles, {
      fields: [verificationEvents.workerProfileId],
      references: [workerProfiles.id],
    }),
    recruiterProfile: one(recruiterProfiles, {
      fields: [verificationEvents.recruiterProfileId],
      references: [recruiterProfiles.id],
    }),
    actor: one(users, {
      fields: [verificationEvents.actorUserId],
      references: [users.id],
    }),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WorkerProfile = typeof workerProfiles.$inferSelect;
export type NewWorkerProfile = typeof workerProfiles.$inferInsert;
export type RecruiterProfile = typeof recruiterProfiles.$inferSelect;
export type NewRecruiterProfile = typeof recruiterProfiles.$inferInsert;
export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
export type RecruiterOpening = typeof recruiterOpenings.$inferSelect;
export type NewRecruiterOpening = typeof recruiterOpenings.$inferInsert;
export type VenueLinkKind = (typeof venueLinkKindEnum.enumValues)[number];
export type VenueReviewStatus =
  (typeof venueReviewStatusEnum.enumValues)[number];
export type ProfilePhoto = typeof profilePhotos.$inferSelect;
export type NewProfilePhoto = typeof profilePhotos.$inferInsert;
export type ProfileView = typeof profileViews.$inferSelect;
export type ProfileInterest = typeof profileInterests.$inferSelect;
export type NewProfileInterest = typeof profileInterests.$inferInsert;
export type ContactRequest = typeof contactRequests.$inferSelect;
export type NewContactRequest = typeof contactRequests.$inferInsert;
export type ContactRequestStatus =
  (typeof contactRequestStatusEnum.enumValues)[number];
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationStatus =
  (typeof conversationStatusEnum.enumValues)[number];
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageKind = (typeof messageKindEnum.enumValues)[number];
export type MessageFlag = typeof messageFlags.$inferSelect;
export type NewMessageFlag = typeof messageFlags.$inferInsert;
export type FlagTarget = (typeof flagTargetEnum.enumValues)[number];
export type FlagStatus = (typeof flagStatusEnum.enumValues)[number];
export type ContactShare = typeof contactShares.$inferSelect;
export type NewContactShare = typeof contactShares.$inferInsert;
export type ContactShareChannel =
  (typeof contactShareChannelEnum.enumValues)[number];
export type UserNotificationPref = typeof userNotificationPrefs.$inferSelect;
export type NewUserNotificationPref = typeof userNotificationPrefs.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationType =
  (typeof notificationTypeEnum.enumValues)[number];
export type DeliveryStatus = (typeof deliveryStatusEnum.enumValues)[number];
export type Subscription = typeof subscriptions.$inferSelect;
export type BillingProduct = (typeof billingProductEnum.enumValues)[number];
export type BillingPriceSetting = typeof billingPriceSettings.$inferSelect;
export type NewBillingPriceSetting = typeof billingPriceSettings.$inferInsert;
export type MessagingSetting = typeof messagingSettings.$inferSelect;
export type NewMessagingSetting = typeof messagingSettings.$inferInsert;
export type TopTalentPass = typeof topTalentPasses.$inferSelect;
export type NewTopTalentPass = typeof topTalentPasses.$inferInsert;
export type VerificationEvent = typeof verificationEvents.$inferSelect;
export type NewVerificationEvent = typeof verificationEvents.$inferInsert;
export type HireOutcome = typeof hireOutcomes.$inferSelect;
export type NewHireOutcome = typeof hireOutcomes.$inferInsert;
export type HireOutcomeConfirmationRequest =
  typeof hireOutcomeConfirmationRequests.$inferSelect;
export type NewHireOutcomeConfirmationRequest =
  typeof hireOutcomeConfirmationRequests.$inferInsert;
export type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];
export type VerificationDecision = (typeof verificationDecisionEnum.enumValues)[number];
export type VerificationMethod = (typeof verificationMethodEnum.enumValues)[number];
export type DocType = (typeof docTypeEnum.enumValues)[number];
export type PhotoModerationStatus = (typeof photoModerationStatusEnum.enumValues)[number];
export type HireOutcomeStatus = (typeof hireOutcomeStatusEnum.enumValues)[number];
export type HireConfirmationRequestedStatus =
  (typeof hireConfirmationRequestedStatusEnum.enumValues)[number];
export type HireConfirmationRequestStatus =
  (typeof hireConfirmationRequestStatusEnum.enumValues)[number];
export type AccountStatus = (typeof accountStatusEnum.enumValues)[number];
export type BillingAccessMode =
  (typeof billingAccessModeEnum.enumValues)[number];
export type AdminEntitlementKind =
  (typeof adminEntitlementKindEnum.enumValues)[number];
export type AdminAuditAction = (typeof adminAuditActionEnum.enumValues)[number];
export type BannedIdentity = typeof bannedIdentities.$inferSelect;
export type NewBannedIdentity = typeof bannedIdentities.$inferInsert;
export type AdminEntitlement = typeof adminEntitlements.$inferSelect;
export type NewAdminEntitlement = typeof adminEntitlements.$inferInsert;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type AdminAuditEvent = typeof adminAuditEvents.$inferSelect;
export type NewAdminAuditEvent = typeof adminAuditEvents.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type UserBlock = typeof userBlocks.$inferSelect;
export type NewUserBlock = typeof userBlocks.$inferInsert;
