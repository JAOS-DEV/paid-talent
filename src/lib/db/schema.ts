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
import { relations } from "drizzle-orm";

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
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
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
    availability: text("availability"),
    expectedPayMin: integer("expected_pay_min"),
    expectedPayMax: integer("expected_pay_max"),
    payCurrency: text("pay_currency").default("USD"),
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
    photoKey: text("photo_key").notNull(),
    photoUrl: text("photo_url").notNull(),
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
  ({ one }) => ({
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
  })
);

export const hireOutcomesRelations = relations(hireOutcomes, ({ one }) => ({
  interest: one(profileInterests, {
    fields: [hireOutcomes.interestId],
    references: [profileInterests.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

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
export type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];
export type VerificationDecision = (typeof verificationDecisionEnum.enumValues)[number];
export type VerificationMethod = (typeof verificationMethodEnum.enumValues)[number];
export type DocType = (typeof docTypeEnum.enumValues)[number];
export type PhotoModerationStatus = (typeof photoModerationStatusEnum.enumValues)[number];
export type HireOutcomeStatus = (typeof hireOutcomeStatusEnum.enumValues)[number];
