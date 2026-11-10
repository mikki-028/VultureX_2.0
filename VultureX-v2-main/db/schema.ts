import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  customType,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Raw binary column used for private pitch deck storage (PDF/PPTX) and
// questionnaire attachments. Files are only ever streamed through an
// authenticated route, never served from a public URL.
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ============================================
// USERS
// ============================================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["startup", "investor", "admin"] }).notNull(),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// STARTUPS
// ============================================
export const startups = pgTable(
  "startups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    sector: text("sector").notNull(),
    stage: text("stage").notNull(),
    location: text("location"),
    website: text("website"),
    logoUrl: text("logo_url"),
    // Narrative
    problem: text("problem"),
    solution: text("solution"),
    // Traction
    mrr: integer("mrr").default(0),
    monthlyGrowth: numeric("monthly_growth", { precision: 5, scale: 2 }).default("0"),
    activeUsers: integer("active_users").default(0),
    customers: integer("customers").default(0),
    // Financials
    fundingRaised: integer("funding_raised").default(0),
    burnRate: integer("burn_rate").default(0),
    runwayMonths: integer("runway_months").default(0),
    // Team
    founderName: text("founder_name"),
    founderRole: text("founder_role"),
    founderBio: text("founder_bio"),
    founderLinkedin: text("founder_linkedin"),
    teamSize: integer("team_size").default(1),
    // Platform
    tags: text("tags").array(),
    // Business matchmaking signals. All optional and additive: profiles saved
    // before these existed keep working, and the matching engine falls back to
    // the narrative fields above when they are empty.
    offerings: text("offerings").array(),
    needs: text("needs").array(),
    targetCustomers: text("target_customers").array(),
    // UN Sustainable Development Goal alignment (official ids 1-17). Optional
    // for every profile, including profiles created before this column existed.
    // Selecting a goal is a self-declared alignment, never a verified outcome.
    sdgGoals: integer("sdg_goals").array().notNull().default([]),
    sdgPrimary: integer("sdg_primary"),
    // Optional founder-written description of the impact the business claims.
    // Only used by the admin impact review and the pitch deck impact slide.
    impactDescription: text("impact_description"),
    stripeConnected: boolean("stripe_connected").default(false),
    score: numeric("score", { precision: 5, scale: 2 }).default("0"),
    scoreBreakdown: jsonb("score_breakdown"),
    isPublic: boolean("is_public").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_startups_sector_score").on(table.sector, table.score),
    index("idx_startups_score").on(table.score),
  ]
);

// ============================================
// INVESTORS
// ============================================
export const investors = pgTable("investors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  fullName: text("full_name").notNull(),
  investorType: text("investor_type").notNull(),
  firmName: text("firm_name"),
  location: text("location"),
  checkSizeMin: integer("check_size_min").default(0),
  checkSizeMax: integer("check_size_max").default(0),
  stageFocus: text("stage_focus").array(),
  sectorFocus: text("sector_focus").array(),
  // SDGs the investor wants to see. Interest only - never a commitment.
  sdgPreferences: integer("sdg_preferences").array().notNull().default([]),
  investmentThesis: text("investment_thesis"),
  linkedin: text("linkedin"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// PITCH DECKS
// ============================================
export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  slides: jsonb("slides").notNull(),
  template: text("template").default("minimal"),
  shareToken: text("share_token").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// COMPETITIONS
// ============================================
// Lifecycle added on top of the original `competitions` table (which only had
// title/description/sector/prize/deadline/status). Every new column is nullable
// or defaulted so the pre-existing rows keep working.
//
// draft -> pending_review -> approved -> scheduled -> open -> closed
//            |  ^                              -> under_evaluation -> completed
//            v  |
//   changes_requested / rejected
// "active" is kept only so legacy rows created before this workflow still read
// back without a type error.
export const COMPETITION_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "rejected",
  "approved",
  "scheduled",
  "open",
  "closed",
  "under_evaluation",
  "completed",
  "active",
] as const;

export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

// Winner announcements are approved separately from the competition itself.
export const WINNER_ANNOUNCEMENT_STATUSES = [
  "none",
  "pending_approval",
  "changes_requested",
  "approved",
] as const;

export type WinnerAnnouncementStatus =
  (typeof WINNER_ANNOUNCEMENT_STATUSES)[number];

export type CompetitionBenefit = {
  mentorship: boolean;
  incubation: boolean;
  pilotPartnership: boolean;
  investorVisibility: boolean;
  other: string | null;
};

export type CompetitionEligibility = {
  allStages: boolean;
  stages: string[];
  sectors: string[];
  minMrr: number | null;
  maxMrr: number | null;
  regions: string[];
  requirements: string | null;
  // Optional impact requirements. Empty/false means "no impact requirement",
  // which keeps every competition created before these fields existed open to
  // startups that have not declared or verified any SDG alignment.
  requiredSdgs?: number[];
  requireVerifiedImpact?: boolean;
};

export type CompetitionCriterion = {
  key: string;
  label: string;
  weight: number;
};

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    // Short summary (reused by the original table).
    description: text("description"),
    fullDescription: text("full_description"),
    // Category / theme (reused by the original table).
    sector: text("sector"),
    // Prize summary (reused by the original table).
    prize: text("prize"),
    prizeAmount: integer("prize_amount"),
    prizeCurrency: text("prize_currency").default("USD"),
    benefits: jsonb("benefits").$type<CompetitionBenefit>().default({
      mentorship: false,
      incubation: false,
      pilotPartnership: false,
      investorVisibility: false,
      other: null,
    }),
    bannerUrl: text("banner_url"),
    // Application deadline (reused by the original table; nullable for drafts).
    deadline: timestamp("deadline", { withTimezone: true }),
    openAt: timestamp("open_at", { withTimezone: true }),
    evaluationEndsAt: timestamp("evaluation_ends_at", { withTimezone: true }),
    winnerAnnouncementAt: timestamp("winner_announcement_at", {
      withTimezone: true,
    }),
    completionAt: timestamp("completion_at", { withTimezone: true }),
    status: text("status", { enum: COMPETITION_STATUSES })
      .notNull()
      .default("draft"),
    hostInvestorId: uuid("host_investor_id").references(() => investors.id, {
      onDelete: "restrict",
    }),
    hostOrganization: text("host_organization"),
    eligibility: jsonb("eligibility")
      .$type<CompetitionEligibility>()
      .default({
        allStages: true,
        stages: [],
        sectors: [],
        minMrr: null,
        maxMrr: null,
        regions: [],
        requirements: null,
      }),
    criteria: jsonb("criteria").$type<CompetitionCriterion[]>().default([]),
    sdgGoals: jsonb("sdg_goals").$type<number[]>().default([]),
    // Optional primary focus goal. Always one of sdgGoals when set.
    sdgPrimary: integer("sdg_primary"),
    rules: text("rules"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    adminFeedback: text("admin_feedback"),
    rejectionReason: text("rejection_reason"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    winnerAnnouncementStatus: text("winner_announcement_status", {
      enum: WINNER_ANNOUNCEMENT_STATUSES,
    })
      .notNull()
      .default("none"),
    winnerAnnouncementApprovedAt: timestamp("winner_announcement_approved_at", {
      withTimezone: true,
    }),
    winnerAnnouncementApprovedByUserId: uuid(
      "winner_announcement_approved_by_user_id"
    ).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_competitions_host").on(table.hostInvestorId),
    index("idx_competitions_status").on(table.status),
    index("idx_competitions_published").on(table.publishedAt, table.deadline),
    check(
      "competitions_prize_amount_non_negative",
      sql`${table.prizeAmount} is null or ${table.prizeAmount} >= 0`
    ),
  ]
);

export const competitionEntries = pgTable(
  "competition_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .references(() => competitions.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    deckId: uuid("deck_id").references(() => decks.id),
    enteredAt: timestamp("entered_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_competition_startup").on(
      table.competitionId,
      table.startupId
    ),
  ]
);

// ============================================
// COMPETITION APPLICATIONS / EVALUATIONS / WINNERS
// ============================================
// submitted -> under_review -> shortlisted -> accepted | rejected
//                                           -> withdrawn (startup, while open)
export const COMPETITION_APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type CompetitionApplicationStatus =
  (typeof COMPETITION_APPLICATION_STATUSES)[number];

export type CompetitionApplicationSnapshot = {
  name: string;
  slug: string;
  tagline: string | null;
  sector: string | null;
  stage: string | null;
  location: string | null;
  mrr: number | null;
  score: number | null;
  // SDG alignment frozen at apply time. Additive: older applications simply
  // do not have these keys.
  sdgGoals?: number[];
  sdgPrimary?: number | null;
};

export const competitionApplications = pgTable(
  "competition_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .references(() => competitions.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    // The account that submitted the application (must own the startup).
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: COMPETITION_APPLICATION_STATUSES })
      .notNull()
      .default("submitted"),
    coverNote: text("cover_note"),
    // Frozen copy of the public profile at apply time.
    snapshot: jsonb("snapshot").$type<CompetitionApplicationSnapshot>(),
    weightedScore: numeric("weighted_score", { precision: 5, scale: 2 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("unique_competition_application").on(
      table.competitionId,
      table.startupId
    ),
    index("idx_ca_competition_status").on(table.competitionId, table.status),
    index("idx_ca_startup").on(table.startupId),
    check(
      "competition_cover_note_length",
      sql`${table.coverNote} is null or char_length(${table.coverNote}) <= 2000`
    ),
  ]
);

// One private evaluation per investor per application. Scores are 0-100 per
// criterion; weighted_score is derived server-side and never trusted from a
// client payload.
export const competitionEvaluations = pgTable(
  "competition_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .references(() => competitionApplications.id, { onDelete: "cascade" })
      .notNull(),
    evaluatorUserId: uuid("evaluator_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scores: jsonb("scores").$type<Record<string, number>>().notNull().default({}),
    weightedScore: numeric("weighted_score", { precision: 5, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_application_evaluator").on(
      table.applicationId,
      table.evaluatorUserId
    ),
    index("idx_ce_application").on(table.applicationId),
    check(
      "competition_evaluation_score_range",
      sql`${table.weightedScore} is null or (${table.weightedScore} >= 0 and ${table.weightedScore} <= 100)`
    ),
  ]
);

export const COMPETITION_WINNER_STATUSES = [
  "proposed",
  "changes_requested",
  "approved",
] as const;

export const competitionWinners = pgTable(
  "competition_winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .references(() => competitions.id, { onDelete: "cascade" })
      .notNull(),
    applicationId: uuid("application_id")
      .references(() => competitionApplications.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    placement: integer("placement").notNull().default(1),
    awardLabel: text("award_label"),
    prizeNote: text("prize_note"),
    status: text("status", { enum: COMPETITION_WINNER_STATUSES })
      .notNull()
      .default("proposed"),
    proposedByUserId: uuid("proposed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    proposedAt: timestamp("proposed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_competition_placement").on(
      table.competitionId,
      table.placement
    ),
    uniqueIndex("unique_competition_winner_startup").on(
      table.competitionId,
      table.startupId
    ),
    index("idx_cw_competition").on(table.competitionId, table.status),
    check("competition_placement_positive", sql`${table.placement} >= 1`),
  ]
);

// Append-only audit trail for every meaningful competition transition.
export const competitionEvents = pgTable(
  "competition_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .references(() => competitions.id, { onDelete: "cascade" })
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role", { enum: ["startup", "investor", "admin"] }),
    type: text("type").notNull(),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cpe_competition").on(table.competitionId, table.createdAt),
  ]
);

// ============================================
// INTERACTIONS
// ============================================
export const interests = pgTable(
  "interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investorId: uuid("investor_id")
      .references(() => investors.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    message: text("message"),
    status: text("status", { enum: ["pending", "accepted", "declined"] }).default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_investor_startup").on(table.investorId, table.startupId),
  ]
);

export const profileViews = pgTable("profile_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  viewerId: uuid("viewer_id").references(() => users.id),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow(),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_user_startup_bookmark").on(table.userId, table.startupId),
  ]
);

export const deckViews = pgTable("deck_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id")
    .references(() => decks.id, { onDelete: "cascade" })
    .notNull(),
  viewerEmail: text("viewer_email"),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// PITCH DECK REQUESTS (questionnaire -> summary -> admin -> published deck)
// ============================================

// incomplete          -> questionnaire not finished (or summary not submitted)
// pending_approval     -> all batches submitted, founder reviewing/approving summary
// approved             -> founder approved the summary, waiting for the admin team
// in_progress          -> admin is preparing the deck (or has uploaded an unpublished draft)
// rejected             -> admin declined the request; reason is in admin_note
// completed            -> admin published the deck, founder can download it
export const PITCH_DECK_STATUSES = [
  "incomplete",
  "pending_approval",
  "approved",
  "in_progress",
  "rejected",
  "completed",
] as const;

export type PitchDeckStatus = (typeof PITCH_DECK_STATUSES)[number];

export const pitchDeckRequests = pgTable(
  "pitch_deck_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    // "new" = separate request, "revision" = improvement of an existing deck
    kind: text("kind", { enum: ["new", "revision"] }).notNull().default("new"),
    // Revision chain: the request this one revises (previous published deck request)
    previousRequestId: uuid("previous_request_id").references(
      (): AnyPgColumn => pitchDeckRequests.id,
      { onDelete: "set null" }
    ),
    version: integer("version").notNull().default(1),
    status: text("status", { enum: PITCH_DECK_STATUSES })
      .notNull()
      .default("incomplete"),
    currentBatch: integer("current_batch").notNull().default(1),
    // Saved questionnaire answers keyed by question id (Q1A, Q2, ... NEW_DESC)
    answers: jsonb("answers").notNull().default({}),
    // Editable summary of profile + questionnaire data
    summary: jsonb("summary"),
    // Frozen copy of the summary at the moment of approval
    approvedSummary: jsonb("approved_summary"),
    // True when the summary was edited after an approval
    summaryChangedSinceApproval: boolean("summary_changed_since_approval")
      .notNull()
      .default(false),
    adminNote: text("admin_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    revisionRequestedAt: timestamp("revision_requested_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_pdr_startup").on(table.startupId),
    index("idx_pdr_status").on(table.status),
    index("idx_pdr_previous").on(table.previousRequestId),
  ]
);

// Private binary files tied to a request. `is_published` is the single gate
// that makes a deck visible to the owning startup.
export const pitchDeckFiles = pgTable(
  "pitch_deck_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .references(() => pitchDeckRequests.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    // "deck" = admin-prepared pitch deck, "product_screenshot" = Q7 attachment
    kind: text("kind", { enum: ["deck", "product_screenshot"] })
      .notNull()
      .default("deck"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    content: bytea("content").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isPublished: boolean("is_published").notNull().default(false),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_pdf_request").on(table.requestId),
    index("idx_pdf_startup").on(table.startupId),
  ]
);

// ============================================
// INTEREST+ / CONNECTIONS / DIRECT MESSAGING
// ============================================
// Additive tables layered on top of the existing users / startups / investors
// model. Nothing here changes the legacy `interests` table, so the existing
// dashboard counters, /interests list and email notifications keep working.

// pending -> recipient has not answered
// accepted -> connection + conversation created
// rejected -> recipient declined; messaging stays locked
// withdrawn -> sender cancelled before a response (can be re-sent)
export const CONNECTION_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type ConnectionRequestStatus =
  (typeof CONNECTION_REQUEST_STATUSES)[number];

// One row per user pair, regardless of direction, so A->B and B->A can never
// produce two live conversations. `pair_key` is `<smaller uuid>:<larger uuid>`.
export const connectionRequests = pgTable(
  "connection_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderUserId: uuid("sender_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    recipientUserId: uuid("recipient_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    pairKey: text("pair_key").notNull(),
    message: text("message"),
    status: text("status", { enum: CONNECTION_REQUEST_STATUSES })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("unique_connection_request_pair").on(table.pairKey),
    index("idx_cr_recipient_status").on(table.recipientUserId, table.status),
    index("idx_cr_sender_status").on(table.senderUserId, table.status),
    check("connection_request_no_self", sql`${table.senderUserId} <> ${table.recipientUserId}`),
  ]
);

// A connection is the durable link created only by an accepted request.
// Participant ids are stored normalized (a < b) and uniquely indexed.
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .references(() => connectionRequests.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    userAId: uuid("user_a_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    userBId: uuid("user_b_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_connection_pair").on(table.userAId, table.userBId),
    index("idx_connections_user_a").on(table.userAId),
    index("idx_connections_user_b").on(table.userBId),
    check("connection_participants_differ", sql`${table.userAId} <> ${table.userBId}`),
  ]
);

// Exactly one conversation per connection.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .references(() => connections.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_conversations_last_message").on(table.lastMessageAt)]
);

// Authorized members of a conversation + their per-user read cursor.
// A nonparticipant has no row here, which is what every message query checks.
export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_conversation_participant").on(
      table.conversationId,
      table.userId
    ),
    index("idx_participant_user").on(table.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    senderUserId: uuid("sender_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_messages_conversation_created").on(
      table.conversationId,
      table.createdAt
    ),
    check(
      "messages_body_length",
      sql`char_length(${table.body}) between 1 and 4000`
    ),
  ]
);

export const NOTIFICATION_TYPES = [
  "interest_request",
  "request_accepted",
  "request_rejected",
  "message",
  // Business matchmaking reuses the same notification table and bell UI.
  "business_match",
  // Competitions reuse the same notification table and bell UI.
  "competition_published",
  "competition_review",
  "competition_application",
  "competition_application_status",
  "competition_winner_proposed",
  "competition_winner_announced",
  // In-app reminders reuse the existing notification bell and unread count.
  "reminder_due",
  // Pitch deck request lifecycle.
  "pitch_deck_submitted",
  "pitch_deck_status",
  "pitch_deck_published",
  // SDG impact claim lifecycle.
  "impact_submitted",
  "impact_review",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    body: text("body"),
    requestId: uuid("request_id").references(() => connectionRequests.id, {
      onDelete: "cascade",
    }),
    connectionId: uuid("connection_id").references(() => connections.id, {
      onDelete: "cascade",
    }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "cascade" }
    ),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    // Idempotency key for notifications that are not tied to a request/message
    // row. Recommendation notifications set it so a retried match run can
    // never duplicate an alert for the same pair + strength tier.
    dedupeKey: text("dedupe_key"),
    competitionId: uuid("competition_id").references(() => competitions.id, {
      onDelete: "cascade",
    }),
    applicationId: uuid("application_id").references(
      () => competitionApplications.id,
      { onDelete: "cascade" }
    ),
    // Set for reminder_due notifications; cascades when the reminder is deleted.
    reminderId: uuid("reminder_id").references(
      (): AnyPgColumn => reminders.id,
      { onDelete: "cascade" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_notifications_recipient").on(
      table.recipientUserId,
      table.createdAt
    ),
    index("idx_notifications_unread").on(
      table.recipientUserId,
      table.readAt
    ),
    index("idx_notifications_competition").on(table.competitionId),
    index("idx_notifications_reminder").on(table.reminderId),
    uniqueIndex("unique_notification_request")
      .on(table.recipientUserId, table.type, table.requestId)
      .where(sql`${table.requestId} is not null`),
    uniqueIndex("unique_notification_message")
      .on(table.recipientUserId, table.type, table.messageId)
      .where(sql`${table.messageId} is not null`),
    uniqueIndex("unique_notification_dedupe_key")
      .on(table.recipientUserId, table.type, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
    // A startup is notified exactly once per published competition, including
    // if an admin re-publishes or the fan-out is retried.
    uniqueIndex("unique_competition_publication_notification")
      .on(table.recipientUserId, table.type, table.competitionId)
      .where(sql`${table.type} = 'competition_published' and ${table.competitionId} is not null`),
  ]
);

// ============================================
// BUSINESS MATCHMAKING
// ============================================
// One row per unordered startup pair. `pair_key` is `<smaller id>:<larger id>`
// so A/B and B/A can never create two recommendations. Rows are written by the
// deterministic engine from real profile data; the UI never invents matches.
//
// active  -> currently above the relevance threshold
// expired -> kept for history after a profile change made it ineligible
export const RECOMMENDATION_STATUSES = ["active", "expired"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const MATCH_STRENGTHS = ["high", "good", "possible"] as const;
export type MatchStrength = (typeof MATCH_STRENGTHS)[number];

export const MATCH_DIMENSIONS = [
  "supplier",
  "complementary",
  "needs",
  "industry",
  "market",
] as const;
export type MatchDimension = (typeof MATCH_DIMENSIONS)[number];

// A single explainable contribution. `label` is the relationship type shown on
// the card, `detail` is the human-readable reason built from the two profiles.
export type MatchReason = {
  dimension: MatchDimension;
  label: string;
  detail: string;
};

// Reasons are stored for both perspectives so each startup sees an
// explanation about its own business, not a generic shared blurb.
export type MatchReasons = {
  aToB: MatchReason[];
  bToA: MatchReason[];
};

export const startupRecommendations = pgTable(
  "startup_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupAId: uuid("startup_a_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    startupBId: uuid("startup_b_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    pairKey: text("pair_key").notNull(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    strength: text("strength", { enum: MATCH_STRENGTHS }).notNull(),
    // Primary relationship type, used for filtering and card badges.
    relationshipType: text("relationship_type").notNull(),
    reasons: jsonb("reasons").$type<MatchReasons>().notNull().default({
      aToB: [],
      bToA: [],
    }),
    // Hash of the matched profile signals. Notification fan-out only runs when
    // this changes, so repeated saves of identical data stay silent.
    signalsHash: text("signals_hash").notNull(),
    status: text("status", { enum: RECOMMENDATION_STATUSES })
      .notNull()
      .default("active"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_recommendation_pair").on(table.pairKey),
    index("idx_recommendation_a").on(table.startupAId, table.status),
    index("idx_recommendation_b").on(table.startupBId, table.status),
    check(
      "recommendation_score_range",
      sql`${table.score} >= 0 and ${table.score} <= 100`
    ),
    check(
      "recommendation_pair_ordered",
      sql`${table.startupAId} < ${table.startupBId}`
    ),
  ]
);

// Per-startup view state. Dismissing or saving a recommendation for one
// startup never changes what the other startup sees.
export const recommendationStates = pgTable(
  "recommendation_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    targetStartupId: uuid("target_startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_recommendation_state_pair").on(
      table.startupId,
      table.targetStartupId
    ),
    index("idx_recommendation_state_startup").on(table.startupId),
  ]
);

// ============================================
// SDG IMPACT VERIFICATION
// ============================================
// A startup files one claim at a time (its current submission) while every
// review decision is appended to impact_verification_events, so the review
// history is preserved without duplicating claim rows.
//
// pending -> verified | rejected | changes_requested
// A verified claim only stays "verified" while claim_signature still matches
// the startup's current goals/description; editing the claim re-opens review.
export const IMPACT_CLAIM_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "changes_requested",
] as const;

export type ImpactClaimStatus = (typeof IMPACT_CLAIM_STATUSES)[number];

export const startupImpactClaims = pgTable(
  "startup_impact_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    status: text("status", { enum: IMPACT_CLAIM_STATUSES })
      .notNull()
      .default("pending"),
    impactDescription: text("impact_description").notNull(),
    sdgGoals: integer("sdg_goals").array().notNull().default([]),
    sdgPrimary: integer("sdg_primary"),
    // SHA-256 of the exact claim content that was reviewed.
    claimSignature: text("claim_signature").notNull(),
    reviewNote: text("review_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_impact_claim_status").on(table.status, table.submittedAt),
    check(
      "impact_claim_description_length",
      sql`char_length(${table.impactDescription}) between 40 and 4000`
    ),
  ]
);

export const IMPACT_EVENT_ACTIONS = [
  "submitted",
  "verified",
  "rejected",
  "changes_requested",
  "withdrawn",
] as const;

export type ImpactEventAction = (typeof IMPACT_EVENT_ACTIONS)[number];

export const impactVerificationEvents = pgTable(
  "impact_verification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    claimId: uuid("claim_id").references(() => startupImpactClaims.id, {
      onDelete: "set null",
    }),
    action: text("action", { enum: IMPACT_EVENT_ACTIONS }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role", { enum: ["startup", "admin"] }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_impact_events_startup").on(table.startupId, table.createdAt),
  ]
);

// Audit trail shown to founders ("summary changed since approval") and admins
export const pitchDeckEvents = pgTable(
  "pitch_deck_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .references(() => pitchDeckRequests.id, { onDelete: "cascade" })
      .notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role", { enum: ["startup", "investor", "admin"] }),
    type: text("type").notNull(),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_pde_request").on(table.requestId)]
);

// ============================================
// FOUNDER PROFILES (Phase 2)
// ============================================
// Personalisation data that does not belong on the public startup profile.
// One row per account, owned through `user_id`; the startup profile remains the
// single source of company facts, so nothing here duplicates it.

export const FOUNDER_LANGUAGES = ["en", "hi", "pa"] as const;
export type FounderLanguage = (typeof FOUNDER_LANGUAGES)[number];

export const COLLABORATION_VISIBILITY = ["public", "network", "private"] as const;
export type CollaborationVisibility = (typeof COLLABORATION_VISIBILITY)[number];

export type ReminderPreferences = {
  inApp: boolean;
  email: boolean;
  taskDue: boolean;
  milestones: boolean;
  clinics: boolean;
};

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  inApp: true,
  email: false,
  taskDue: true,
  milestones: true,
  clinics: true,
};

export const founderProfiles = pgTable("founder_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  location: text("location"),
  preferredLanguage: text("preferred_language", { enum: FOUNDER_LANGUAGES })
    .notNull()
    .default("en"),
  currentObjective: text("current_objective"),
  challenges: text("challenges").array().notNull().default([]),
  guidanceAreas: text("guidance_areas").array().notNull().default([]),
  priorities: text("priorities").array().notNull().default([]),
  learningInterests: text("learning_interests").array().notNull().default([]),
  fundingInterest: text("funding_interest"),
  marketingNeeds: text("marketing_needs").array().notNull().default([]),
  collaborationInterests: text("collaboration_interests").array().notNull().default([]),
  recommendationTypes: text("recommendation_types").array().notNull().default([
    "roadmap",
    "resources",
    "opportunities",
  ]),
  reminderPreferences: jsonb("reminder_preferences")
    .$type<ReminderPreferences>()
    .notNull()
    .default(DEFAULT_REMINDER_PREFERENCES),
  profileVisibility: boolean("profile_visibility").notNull().default(true),
  collaborationVisibility: text("collaboration_visibility", {
    enum: COLLABORATION_VISIBILITY,
  })
    .notNull()
    .default("private"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// FOUNDER ROADMAP (Phase 2, Session 2)
// ============================================
// A roadmap is owned by both the account and its startup. Template tasks are
// inserted only when the founder explicitly builds the roadmap; no task is
// pre-completed and no progress is inferred from the startup profile.

export const ROADMAP_TASK_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
] as const;
export type RoadmapTaskStatus = (typeof ROADMAP_TASK_STATUSES)[number];

export const ROADMAP_TASK_PRIORITIES = ["high", "medium", "low"] as const;
export type RoadmapTaskPriority = (typeof ROADMAP_TASK_PRIORITIES)[number];

export const ROADMAP_TASK_SOURCES = ["template", "custom"] as const;
export type RoadmapTaskSource = (typeof ROADMAP_TASK_SOURCES)[number];

export const ROADMAP_MILESTONE_STATUSES = [
  "planned",
  "in_progress",
  "achieved",
] as const;
export type RoadmapMilestoneStatus = (typeof ROADMAP_MILESTONE_STATUSES)[number];

export const roadmapTasks = pgTable(
  "roadmap_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    // Stable template key (or generated custom key) unique per startup.
    taskKey: text("task_key").notNull(),
    stage: text("stage").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("General"),
    priority: text("priority", { enum: ROADMAP_TASK_PRIORITIES })
      .notNull()
      .default("medium"),
    status: text("status", { enum: ROADMAP_TASK_STATUSES })
      .notNull()
      .default("not_started"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    source: text("source", { enum: ROADMAP_TASK_SOURCES })
      .notNull()
      .default("template"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_roadmap_task").on(table.startupId, table.taskKey),
    index("idx_roadmap_tasks_startup_status").on(
      table.startupId,
      table.status,
      table.sortOrder
    ),
    index("idx_roadmap_tasks_user").on(table.userId),
    check(
      "roadmap_task_title_length",
      sql`char_length(${table.title}) between 1 and 160`
    ),
    check(
      "roadmap_task_description_length",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`
    ),
  ]
);

export const roadmapMilestones = pgTable(
  "roadmap_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    startupId: uuid("startup_id")
      .references(() => startups.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    status: text("status", { enum: ROADMAP_MILESTONE_STATUSES })
      .notNull()
      .default("planned"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_roadmap_milestones_startup").on(
      table.startupId,
      table.status,
      table.targetDate
    ),
    index("idx_roadmap_milestones_user").on(table.userId),
    check(
      "roadmap_milestone_title_length",
      sql`char_length(${table.title}) between 1 and 160`
    ),
    check(
      "roadmap_milestone_description_length",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`
    ),
  ]
);

// ============================================
// SAVED RESOURCES (Phase 2, Session 3)
// ============================================
// A founder saves a Knowledge Hub entry by its stable server-side key. The
// snapshot fields keep the saved view readable if the hub copy later changes;
// the key remains the deduplication and ownership boundary.

export const savedResources = pgTable(
  "saved_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    resourceKey: text("resource_key").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    href: text("href").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_saved_resource").on(table.userId, table.resourceKey),
    index("idx_saved_resources_user").on(table.userId, table.createdAt),
    index("idx_saved_resources_category").on(table.userId, table.category),
    check(
      "saved_resource_title_length",
      sql`char_length(${table.title}) between 1 and 160`
    ),
    check(
      "saved_resource_key_length",
      sql`char_length(${table.resourceKey}) between 1 and 2048`
    ),
    check(
      "saved_resource_description_length",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`
    ),
  ]
);

// ============================================
// REMINDERS (Phase 2, Session 3)
// ============================================
// A reminder is independent of its linked task: completing one never changes
// the other. dueAt is always stored in UTC; a date-only reminder uses 23:59 UTC
// and hasTime=false so it means "by the end of that day".

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    hasTime: boolean("has_time").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    roadmapTaskId: uuid("roadmap_task_id").references(() => roadmapTasks.id, {
      onDelete: "set null",
    }),
    savedResourceId: uuid("saved_resource_id").references(
      () => savedResources.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_reminders_user_due").on(table.userId, table.completedAt, table.dueAt),
    index("idx_reminders_roadmap_task").on(table.userId, table.roadmapTaskId),
    check("reminder_title_length", sql`char_length(${table.title}) between 1 and 160`),
    check(
      "reminder_description_length",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`
    ),
  ]
);
