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

export const adminEntitlementKindEnum = pgEnum("admin_entitlement_kind", [
  "top_talent_unlock",
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
  "identity_verification_approved",
  "identity_verification_rejected",
  "identity_verification_revoked",
  "photo_approved",
  "photo_rejected",
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
    expectedPayMin: integer("expected_pay_min"),
    expectedPayMax: integer("expected_pay_max"),
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
    logoKey: text("logo_key"),
    logoUrl: text("logo_url"),
    area: text("area"),
    subArea: text("sub_area"),
    blurb: text("blurb"),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("recruiter_profiles_user_id_idx").on(table.userId),
    index("recruiter_profiles_area_idx").on(table.area),
  ]
);

export const recruiterOpenings = pgTable(
  "recruiter_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterProfileId: uuid("recruiter_profile_id")
      .notNull()
      .references(() => recruiterProfiles.id, { onDelete: "cascade" }),
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

export const hireOutcomes = pgTable(
  "hire_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interestId: uuid("interest_id")
      .notNull()
      .unique()
      .references(() => profileInterests.id, { onDelete: "cascade" }),
    status: hireOutcomeStatusEnum("status").notNull().default("interested"),
    hiredAt: timestamp("hired_at", { mode: "date" }),
    startedAt: timestamp("started_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("hire_outcomes_interest_id_idx").on(table.interestId),
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
  })
);

export const recruiterOpeningsRelations = relations(
  recruiterOpenings,
  ({ one, many }) => ({
    recruiterProfile: one(recruiterProfiles, {
      fields: [recruiterOpenings.recruiterProfileId],
      references: [recruiterProfiles.id],
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

export const hireOutcomesRelations = relations(hireOutcomes, ({ one }) => ({
  interest: one(profileInterests, {
    fields: [hireOutcomes.interestId],
    references: [profileInterests.id],
  }),
}));

export const hireOutcomeConfirmationRequestsRelations = relations(
  hireOutcomeConfirmationRequests,
  ({ one }) => ({
    interest: one(profileInterests, {
      fields: [hireOutcomeConfirmationRequests.interestId],
      references: [profileInterests.id],
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
export type RecruiterOpening = typeof recruiterOpenings.$inferSelect;
export type NewRecruiterOpening = typeof recruiterOpenings.$inferInsert;
export type ProfilePhoto = typeof profilePhotos.$inferSelect;
export type NewProfilePhoto = typeof profilePhotos.$inferInsert;
export type ProfileView = typeof profileViews.$inferSelect;
export type ProfileInterest = typeof profileInterests.$inferSelect;
export type NewProfileInterest = typeof profileInterests.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
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
