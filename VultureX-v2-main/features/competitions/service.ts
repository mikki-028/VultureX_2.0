import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  competitionApplications,
  competitionEvaluations,
  competitionEvents,
  competitionWinners,
  competitions,
  investors,
  startups,
  startupImpactClaims,
  type CompetitionApplicationStatus,
  type CompetitionCriterion,
  type CompetitionEligibility,
  type CompetitionStatus,
} from "@/db/schema";
import { isUuid, sqlStateOf } from "@/lib/utils";
import { competitionSdgCondition } from "@/features/sdg/filters";
import { effectiveImpactStatus } from "@/features/sdg/verification";
import type { ImpactStatus } from "@/features/sdg/status";
import type { CompetitionActor } from "./access";
import { evaluateEligibility, eligibilitySummary } from "./eligibility";
import type { EligibilityResult } from "./eligibility";
import { CompetitionError } from "./errors";
import {
  notifyAdmins,
  notifyInvestor,
  notifyStartup,
  notifyStartupsOfPublication,
} from "./notifications";
import { APPLICATION_STATUS_LABELS, prizeLabel } from "./types";
import { normalizeCompetitionInput, submissionProblems } from "./validation";
import type { CompetitionInput } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CompetitionRow = typeof competitions.$inferSelect;
type InvestorRow = typeof investors.$inferSelect;

export type CompetitionPhase =
  | "unpublished"
  | "upcoming"
  | "open"
  | "closed"
  | "completed";

/** Statuses that are never visible outside the host and admins. */
const PRIVATE_STATUSES: CompetitionStatus[] = [
  "draft",
  "pending_review",
  "changes_requested",
  "rejected",
];

export function phaseOf(
  competition: Pick<
    CompetitionRow,
    "publishedAt" | "openAt" | "deadline" | "status"
  >,
  now = new Date()
): CompetitionPhase {
  if (!competition.publishedAt) return "unpublished";
  if (competition.status === "completed") return "completed";
  const opensAt = competition.openAt ?? competition.publishedAt;
  if (opensAt && now < opensAt) return "upcoming";
  if (competition.deadline && now >= competition.deadline) return "closed";
  if (
    competition.status === "closed" ||
    competition.status === "under_evaluation"
  )
    return "closed";
  return "open";
}

export function acceptsApplications(
  competition: Pick<
    CompetitionRow,
    "publishedAt" | "openAt" | "deadline" | "status"
  >,
  now = new Date()
): boolean {
  if (!competition.publishedAt) return false;
  if (
    competition.status === "closed" ||
    competition.status === "under_evaluation" ||
    competition.status === "completed"
  )
    return false;
  if (!competition.openAt || !competition.deadline) return false;
  return now >= competition.openAt && now < competition.deadline;
}

function hostLabel(investor: InvestorRow | null | undefined): string {
  if (!investor) return "VultureX";
  return investor.firmName || investor.fullName || "VultureX";
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export type CriteriaView = CompetitionCriterion[];

export type CompetitionCard = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  host: string;
  prize: string | null;
  prizeAmount: number | null;
  prizeCurrency: string | null;
  benefits: string[];
  opensAt: string | null;
  deadline: string | null;
  applicationCount: number;
  criteria: CriteriaView;
  eligibilityLines: string[];
  sdgGoals: number[];
  sdgPrimary: number | null;
  phase: CompetitionPhase;
  status: CompetitionStatus;
};

export type PastWinnerGroup = {
  competitionId: string;
  competitionTitle: string;
  host: string;
  completedAt: string | null;
  prize: string | null;
  winners: {
    id: string;
    placement: number;
    awardLabel: string | null;
    prizeNote: string | null;
    startupName: string;
    startupSlug: string;
    publishedAt: string | null;
  }[];
};

export type CompetitionView = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  host: string;
  hostOrganization: string | null;
  hostInvestorUserId: string | null;
  prize: string | null;
  prizeAmount: number | null;
  prizeCurrency: string | null;
  benefits: {
    mentorship: boolean;
    incubation: boolean;
    pilotPartnership: boolean;
    investorVisibility: boolean;
    other: string | null;
  };
  bannerUrl: string | null;
  opensAt: string | null;
  deadline: string | null;
  evaluationEndsAt: string | null;
  winnerAnnouncementAt: string | null;
  completionAt: string | null;
  status: CompetitionStatus;
  phase: CompetitionPhase;
  publishedAt: string | null;
  applicationCount: number;
  criteria: CriteriaView;
  eligibility: CompetitionEligibility;
  eligibilityLines: string[];
  sdgGoals: number[];
  sdgPrimary: number | null;
  rules: string | null;
  winnerAnnouncementStatus: string;
  // Only populated for the hosting investor and admins.
  adminFeedback: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
};

export type WinnerView = {
  id: string;
  placement: number;
  awardLabel: string | null;
  prizeNote: string | null;
  status: string;
  startupId: string;
  startupName: string;
  startupSlug: string;
  publishedAt: string | null;
};

function toCard(
  competition: CompetitionRow,
  investor: InvestorRow | null,
  applicationCount: number,
  now = new Date()
): CompetitionCard {
  return {
    id: competition.id,
    title: competition.title,
    summary: competition.description,
    category: competition.sector,
    host: hostLabel(investor),
    prize: prizeLabel({
      prizeAmount: competition.prizeAmount,
      prizeCurrency: competition.prizeCurrency,
      prize: competition.prize,
    }),
    prizeAmount: competition.prizeAmount,
    prizeCurrency: competition.prizeCurrency,
    benefits: benefitList(competition.benefits),
    opensAt: iso(competition.openAt),
    deadline: iso(competition.deadline),
    applicationCount,
    criteria: competition.criteria ?? [],
    eligibilityLines: eligibilitySummary(competition.eligibility),
    sdgGoals: competition.sdgGoals ?? [],
    sdgPrimary: competition.sdgPrimary ?? null,
    phase: phaseOf(competition, now),
    status: competition.status,
  };
}

function benefitList(raw: CompetitionRow["benefits"]): string[] {
  if (!raw) return [];
  const list: string[] = [];
  if (raw.mentorship) list.push("Mentorship");
  if (raw.incubation) list.push("Incubation");
  if (raw.pilotPartnership) list.push("Pilot partnership");
  if (raw.investorVisibility) list.push("Investor visibility");
  if (raw.other) list.push(raw.other);
  return list;
}

function toView(
  competition: CompetitionRow,
  investor: InvestorRow | null,
  applicationCount: number,
  includePrivate: boolean,
  now = new Date()
): CompetitionView {
  return {
    id: competition.id,
    title: competition.title,
    summary: competition.description,
    description: competition.fullDescription,
    category: competition.sector,
    host: competition.hostOrganization || hostLabel(investor),
    hostOrganization: competition.hostOrganization,
    hostInvestorUserId: null,
    prize: prizeLabel({
      prizeAmount: competition.prizeAmount,
      prizeCurrency: competition.prizeCurrency,
      prize: competition.prize,
    }),
    prizeAmount: competition.prizeAmount,
    prizeCurrency: competition.prizeCurrency,
    benefits: {
      mentorship: competition.benefits?.mentorship ?? false,
      incubation: competition.benefits?.incubation ?? false,
      pilotPartnership: competition.benefits?.pilotPartnership ?? false,
      investorVisibility: competition.benefits?.investorVisibility ?? false,
      other: competition.benefits?.other ?? null,
    },
    bannerUrl: competition.bannerUrl,
    opensAt: iso(competition.openAt),
    deadline: iso(competition.deadline),
    evaluationEndsAt: iso(competition.evaluationEndsAt),
    winnerAnnouncementAt: iso(competition.winnerAnnouncementAt),
    completionAt: iso(competition.completionAt),
    status: competition.status,
    phase: phaseOf(competition, now),
    publishedAt: iso(competition.publishedAt),
    applicationCount,
    criteria: competition.criteria ?? [],
    eligibility: competition.eligibility ?? {
      allStages: true,
      stages: [],
      sectors: [],
      minMrr: null,
      maxMrr: null,
      regions: [],
      requirements: null,
    },
    eligibilityLines: eligibilitySummary(competition.eligibility),
    sdgGoals: competition.sdgGoals ?? [],
    sdgPrimary: competition.sdgPrimary ?? null,
    rules: competition.rules,
    winnerAnnouncementStatus: competition.winnerAnnouncementStatus,
    adminFeedback: includePrivate ? competition.adminFeedback : null,
    rejectionReason: includePrivate ? competition.rejectionReason : null,
    submittedAt: includePrivate ? iso(competition.submittedAt) : null,
    reviewedAt: includePrivate ? iso(competition.reviewedAt) : null,
    createdAt: iso(competition.createdAt),
  };
}

async function applicationCounts(
  competitionIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (competitionIds.length === 0) return map;
  const rows = await db
    .select({
      competitionId: competitionApplications.competitionId,
      count: sql<number>`count(*)`,
    })
    .from(competitionApplications)
    .where(inArray(competitionApplications.competitionId, competitionIds))
    .groupBy(competitionApplications.competitionId);
  for (const row of rows) map.set(row.competitionId, Number(row.count));
  return map;
}

async function loadCompetition(
  competitionId: string
): Promise<{ competition: CompetitionRow; investor: InvestorRow | null } | null> {
  if (!isUuid(competitionId)) return null;
  const [row] = await db
    .select({ competition: competitions, investor: investors })
    .from(competitions)
    .leftJoin(investors, eq(investors.id, competitions.hostInvestorId))
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!row) return null;
  return { competition: row.competition, investor: row.investor };
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

export async function getDiscovery(
  now = new Date(),
  sdg: number | null = null
): Promise<{
  active: CompetitionCard[];
  upcoming: CompetitionCard[];
  pastWinners: PastWinnerGroup[];
  closed: CompetitionCard[];
}> {
  const rows = await db
    .select({ competition: competitions, investor: investors })
    .from(competitions)
    .leftJoin(investors, eq(investors.id, competitions.hostInvestorId))
    .where(
      and(
        isNotNull(competitions.publishedAt),
        notInArray(competitions.status, PRIVATE_STATUSES),
        ...(sdg ? [competitionSdgCondition(competitions.sdgGoals, [sdg])] : [])
      )
    )
    .orderBy(asc(competitions.deadline));

  const counts = await applicationCounts(rows.map((row) => row.competition.id));

  const active: CompetitionCard[] = [];
  const upcoming: CompetitionCard[] = [];
  const closed: CompetitionCard[] = [];

  for (const row of rows) {
    const card = toCard(
      row.competition,
      row.investor,
      counts.get(row.competition.id) ?? 0,
      now
    );
    if (card.phase === "open") active.push(card);
    else if (card.phase === "upcoming") upcoming.push(card);
    else if (card.phase === "closed") closed.push(card);
  }

  return {
    active,
    upcoming,
    closed,
    pastWinners: await getPastWinners(),
  };
}

export async function getPastWinners(): Promise<PastWinnerGroup[]> {
  const rows = await db
    .select({
      winner: competitionWinners,
      competition: competitions,
      startup: startups,
      investor: investors,
    })
    .from(competitionWinners)
    .innerJoin(
      competitions,
      eq(competitions.id, competitionWinners.competitionId)
    )
    .innerJoin(startups, eq(startups.id, competitionWinners.startupId))
    .leftJoin(investors, eq(investors.id, competitions.hostInvestorId))
    .where(
      and(
        eq(competitionWinners.status, "approved"),
        isNotNull(competitionWinners.publishedAt),
        eq(competitions.winnerAnnouncementStatus, "approved")
      )
    )
    .orderBy(
      desc(competitions.completionAt),
      asc(competitionWinners.placement)
    );

  const groups = new Map<string, PastWinnerGroup>();
  for (const row of rows) {
    const group = groups.get(row.competition.id) ?? {
      competitionId: row.competition.id,
      competitionTitle: row.competition.title,
      host: row.competition.hostOrganization || hostLabel(row.investor),
      completedAt: iso(
        row.competition.completionAt ?? row.competition.publishedAt
      ),
      prize: prizeLabel({
        prizeAmount: row.competition.prizeAmount,
        prizeCurrency: row.competition.prizeCurrency,
        prize: row.competition.prize,
      }),
      winners: [],
    };
    group.winners.push({
      id: row.winner.id,
      placement: row.winner.placement,
      awardLabel: row.winner.awardLabel,
      prizeNote: row.winner.prizeNote,
      startupName: row.startup.name,
      startupSlug: row.startup.slug,
      publishedAt: iso(row.winner.publishedAt),
    });
    groups.set(row.competition.id, group);
  }

  return [...groups.values()];
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

export type CompetitionDetail = {
  competition: CompetitionView;
  winners: WinnerView[];
  application: {
    id: string;
    status: string;
    coverNote: string | null;
    submittedAt: string;
    weightedScore: number | null;
    decidedAt: string | null;
  } | null;
  eligibility: EligibilityResult | null;
  isHost: boolean;
  canEdit: boolean;
  canManage: boolean;
  canReview: boolean;
  canApply: boolean;
  viewerRole: string | null;
};

export async function getCompetitionDetail(
  competitionId: string,
  actor: CompetitionActor | null
): Promise<CompetitionDetail | null> {
  const loaded = await loadCompetition(competitionId);
  if (!loaded) return null;
  const { competition, investor } = loaded;

  const isHost =
    !!actor?.investorId && competition.hostInvestorId === actor.investorId;
  const canReview = actor?.role === "admin";
  const includePrivate = isHost || canReview;

  // Unpublished proposals are only visible to their host and admins.
  if (!competition.publishedAt && !includePrivate) return null;

  const counts = await applicationCounts([competition.id]);
  const view = toView(
    competition,
    investor,
    counts.get(competition.id) ?? 0,
    includePrivate
  );
  view.hostInvestorUserId = investor?.userId ?? null;

  const winnerRows = await db
    .select({ winner: competitionWinners, startup: startups })
    .from(competitionWinners)
    .innerJoin(startups, eq(startups.id, competitionWinners.startupId))
    .where(eq(competitionWinners.competitionId, competition.id))
    .orderBy(asc(competitionWinners.placement));

  const publicWinners = winnerRows.filter(
    (row) =>
      row.winner.status === "approved" && row.winner.publishedAt !== null
  );
  const visibleWinners = includePrivate ? winnerRows : publicWinners;

  let application: CompetitionDetail["application"] = null;
  let eligibility: EligibilityResult | null = null;

  if (actor?.role === "startup" && actor.startupId) {
    const [claim] = await db
      .select()
      .from(startupImpactClaims)
      .where(eq(startupImpactClaims.startupId, actor.startupId))
      .limit(1);
    eligibility = evaluateEligibility(
      actor.startup,
      competition.eligibility,
      { status: effectiveImpactStatus(actor.startup!, claim) }
    );
    const [row] = await db
      .select()
      .from(competitionApplications)
      .where(
        and(
          eq(competitionApplications.competitionId, competition.id),
          eq(competitionApplications.startupId, actor.startupId)
        )
      )
      .limit(1);
    if (row) {
      application = {
        id: row.id,
        status: row.status,
        coverNote: row.coverNote,
        submittedAt: row.submittedAt.toISOString(),
        weightedScore: row.weightedScore
          ? Number(row.weightedScore)
          : null,
        decidedAt: iso(row.decidedAt),
      };
    }
  }

  return {
    competition: view,
    winners: visibleWinners.map(({ winner, startup }) => ({
      id: winner.id,
      placement: winner.placement,
      awardLabel: winner.awardLabel,
      prizeNote: winner.prizeNote,
      status: winner.status,
      startupId: startup.id,
      startupName: startup.name,
      startupSlug: startup.slug,
      publishedAt: iso(winner.publishedAt),
    })),
    application,
    eligibility,
    isHost,
    canEdit:
      isHost &&
      (competition.status === "draft" ||
        competition.status === "changes_requested"),
    canManage: isHost,
    canReview,
    canApply:
      actor?.role === "startup" &&
      !!actor.startupId &&
      !application &&
      acceptsApplications(competition),
    viewerRole: actor?.role ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Investor lists + management                                         */
/* ------------------------------------------------------------------ */

export type InvestorCompetitionRow = {
  competition: CompetitionView;
  applications: number;
  pending: number;
  shortlisted: number;
  winners: number;
};

export async function getInvestorCompetitions(
  investorId: string
): Promise<InvestorCompetitionRow[]> {
  const rows = await db
    .select({ competition: competitions, investor: investors })
    .from(competitions)
    .leftJoin(investors, eq(investors.id, competitions.hostInvestorId))
    .where(eq(competitions.hostInvestorId, investorId))
    .orderBy(desc(competitions.updatedAt));

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.competition.id);

  const stats = await db
    .select({
      competitionId: competitionApplications.competitionId,
      status: competitionApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(competitionApplications)
    .where(inArray(competitionApplications.competitionId, ids))
    .groupBy(
      competitionApplications.competitionId,
      competitionApplications.status
    );

  const winnerCounts = await db
    .select({
      competitionId: competitionWinners.competitionId,
      count: sql<number>`count(*)`,
    })
    .from(competitionWinners)
    .where(inArray(competitionWinners.competitionId, ids))
    .groupBy(competitionWinners.competitionId);

  const byCompetition = new Map<
    string,
    { total: number; pending: number; shortlisted: number }
  >();
  for (const row of stats) {
    const entry = byCompetition.get(row.competitionId) ?? {
      total: 0,
      pending: 0,
      shortlisted: 0,
    };
    const count = Number(row.count);
    entry.total += count;
    if (row.status === "submitted" || row.status === "under_review")
      entry.pending += count;
    if (row.status === "shortlisted") entry.shortlisted += count;
    byCompetition.set(row.competitionId, entry);
  }
  const winnersByCompetition = new Map(
    winnerCounts.map((row) => [row.competitionId, Number(row.count)])
  );

  return rows.map((row) => {
    const entry = byCompetition.get(row.competition.id) ?? {
      total: 0,
      pending: 0,
      shortlisted: 0,
    };
    return {
      competition: toView(
        row.competition,
        row.investor,
        entry.total,
        true
      ),
      applications: entry.total,
      pending: entry.pending,
      shortlisted: entry.shortlisted,
      winners: winnersByCompetition.get(row.competition.id) ?? 0,
    };
  });
}

export type ApplicantRow = {
  id: string;
  status: CompetitionApplicationStatus;
  coverNote: string | null;
  submittedAt: string;
  weightedScore: number | null;
  decidedAt: string | null;
  startup: {
    id: string;
    name: string;
    slug: string;
    sector: string;
    stage: string;
    tagline: string | null;
    location: string | null;
    mrr: number | null;
    score: number | null;
  };
  /** SDG context for evaluation. Declared goals are never treated as verified. */
  sdgGoals: number[];
  sdgPrimary: number | null;
  impactStatus: ImpactStatus;
  evaluation: {
    id: string;
    scores: Record<string, number>;
    weightedScore: number | null;
    notes: string | null;
    updatedAt: string;
  } | null;
};

export type CompetitionEventsRow = {
  id: string;
  type: string;
  message: string | null;
  actorRole: string | null;
  createdAt: string;
};

export type InvestorCompetitionDetail = {
  competition: CompetitionView;
  applicants: ApplicantRow[];
  totalApplicants: number;
  winners: WinnerView[];
  events: CompetitionEventsRow[];
  statusCounts: Record<string, number>;
};

export async function getInvestorCompetition(
  actor: CompetitionActor,
  competitionId: string,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<InvestorCompetitionDetail | null> {
  if (actor.role !== "investor" || !actor.investorId) {
    throw new CompetitionError(
      "Only the hosting investor can manage this competition.",
      403,
      "NOT_HOST"
    );
  }
  const loaded = await loadCompetition(competitionId);
  if (!loaded) return null;
  if (loaded.competition.hostInvestorId !== actor.investorId) {
    throw new CompetitionError(
      "Only the hosting investor can manage this competition.",
      403,
      "NOT_HOST"
    );
  }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);

  const filters = [
    eq(competitionApplications.competitionId, competitionId),
  ];
  if (options.status && options.status !== "all") {
    filters.push(
      eq(
        competitionApplications.status,
        options.status as CompetitionApplicationStatus
      )
    );
  }

  const applicantRows = await db
    .select({
      application: competitionApplications,
      startup: startups,
      evaluation: competitionEvaluations,
      impactClaim: startupImpactClaims,
    })
    .from(competitionApplications)
    .innerJoin(startups, eq(startups.id, competitionApplications.startupId))
    .leftJoin(
      startupImpactClaims,
      eq(startupImpactClaims.startupId, competitionApplications.startupId)
    )
    .leftJoin(
      competitionEvaluations,
      and(
        eq(
          competitionEvaluations.applicationId,
          competitionApplications.id
        ),
        eq(competitionEvaluations.evaluatorUserId, actor.userId)
      )
    )
    .where(and(...filters))
    .orderBy(desc(competitionApplications.submittedAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(competitionApplications)
    .where(and(...filters));

  const statusRows = await db
    .select({
      status: competitionApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(competitionApplications)
    .where(eq(competitionApplications.competitionId, competitionId))
    .groupBy(competitionApplications.status);
  const statusCounts: Record<string, number> = {};
  for (const row of statusRows) statusCounts[row.status] = Number(row.count);

  const winnerRows = await db
    .select({ winner: competitionWinners, startup: startups })
    .from(competitionWinners)
    .innerJoin(startups, eq(startups.id, competitionWinners.startupId))
    .where(eq(competitionWinners.competitionId, competitionId))
    .orderBy(asc(competitionWinners.placement));

  const eventRows = await db
    .select()
    .from(competitionEvents)
    .where(eq(competitionEvents.competitionId, competitionId))
    .orderBy(desc(competitionEvents.createdAt))
    .limit(40);

  const totalApplicants = Number(totalRow?.count ?? 0);

  return {
    competition: toView(
      loaded.competition,
      loaded.investor,
      totalApplicants,
      true
    ),
    applicants: applicantRows.map((row) => ({
      id: row.application.id,
      status: row.application.status,
      coverNote: row.application.coverNote,
      submittedAt: row.application.submittedAt.toISOString(),
      weightedScore: row.application.weightedScore
        ? Number(row.application.weightedScore)
        : null,
      decidedAt: iso(row.application.decidedAt),
      startup: {
        id: row.startup.id,
        name: row.startup.name,
        slug: row.startup.slug,
        sector: row.startup.sector,
        stage: row.startup.stage,
        tagline: row.startup.tagline,
        location: row.startup.location,
        mrr: row.startup.mrr,
        score: row.startup.score ? Number(row.startup.score) : null,
      },
      sdgGoals: row.startup.sdgGoals ?? [],
      sdgPrimary: row.startup.sdgPrimary ?? null,
      impactStatus: effectiveImpactStatus(row.startup, row.impactClaim),
      evaluation: row.evaluation
        ? {
            id: row.evaluation.id,
            scores: row.evaluation.scores ?? {},
            weightedScore: row.evaluation.weightedScore
              ? Number(row.evaluation.weightedScore)
              : null,
            notes: row.evaluation.notes,
            updatedAt: row.evaluation.updatedAt.toISOString(),
          }
        : null,
    })),
    totalApplicants,
    winners: winnerRows.map(({ winner, startup }) => ({
      id: winner.id,
      placement: winner.placement,
      awardLabel: winner.awardLabel,
      prizeNote: winner.prizeNote,
      status: winner.status,
      startupId: startup.id,
      startupName: startup.name,
      startupSlug: startup.slug,
      publishedAt: iso(winner.publishedAt),
    })),
    events: eventRows.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      actorRole: row.actorRole,
      createdAt: row.createdAt.toISOString(),
    })),
    statusCounts,
  };
}

/* ------------------------------------------------------------------ */
/* Startup applications                                                */
/* ------------------------------------------------------------------ */

export type StartupApplicationRow = {
  id: string;
  status: CompetitionApplicationStatus;
  coverNote: string | null;
  submittedAt: string;
  decidedAt: string | null;
  competition: CompetitionCard;
  result: {
    won: boolean;
    placement: number;
    awardLabel: string | null;
  } | null;
};

export async function getStartupApplications(
  actor: CompetitionActor
): Promise<StartupApplicationRow[]> {
  if (actor.role !== "startup" || !actor.startupId) return [];

  const rows = await db
    .select({
      application: competitionApplications,
      competition: competitions,
      investor: investors,
    })
    .from(competitionApplications)
    .innerJoin(
      competitions,
      eq(competitions.id, competitionApplications.competitionId)
    )
    .leftJoin(investors, eq(investors.id, competitions.hostInvestorId))
    .where(eq(competitionApplications.startupId, actor.startupId))
    .orderBy(desc(competitionApplications.submittedAt));

  const winnerRows = await db
    .select()
    .from(competitionWinners)
    .where(eq(competitionWinners.startupId, actor.startupId));
  const winnerByCompetition = new Map(
    winnerRows.map((row) => [row.competitionId, row])
  );

  return rows.map(({ application, competition, investor }) => {
    const winner = winnerByCompetition.get(competition.id);
    const published = winner?.status === "approved" && winner.publishedAt;
    return {
      id: application.id,
      status: application.status,
      coverNote: application.coverNote,
      submittedAt: application.submittedAt.toISOString(),
      decidedAt: iso(application.decidedAt),
      competition: toCard(competition, investor, 0),
      result: published
        ? {
            won: true,
            placement: winner.placement,
            awardLabel: winner.awardLabel,
          }
        : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type AdminCompetitionRow = {
  competition: CompetitionView;
  applications: number;
  pending: number;
  winners: number;
};

export async function getAdminCompetitions(): Promise<AdminCompetitionRow[]> {
  const rows = await db
    .select({ competition: competitions, investor: investors })
    .from(competitions)
    .leftJoin(investors, eq(investors.id, competitions.hostInvestorId))
    .orderBy(desc(competitions.updatedAt));

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.competition.id);

  const stats = await db
    .select({
      competitionId: competitionApplications.competitionId,
      status: competitionApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(competitionApplications)
    .where(inArray(competitionApplications.competitionId, ids))
    .groupBy(
      competitionApplications.competitionId,
      competitionApplications.status
    );

  const winnerCounts = await db
    .select({
      competitionId: competitionWinners.competitionId,
      count: sql<number>`count(*)`,
    })
    .from(competitionWinners)
    .where(inArray(competitionWinners.competitionId, ids))
    .groupBy(competitionWinners.competitionId);

  const totals = new Map<string, { total: number; pending: number }>();
  for (const row of stats) {
    const entry = totals.get(row.competitionId) ?? { total: 0, pending: 0 };
    const count = Number(row.count);
    entry.total += count;
    if (row.status === "submitted" || row.status === "under_review")
      entry.pending += count;
    totals.set(row.competitionId, entry);
  }
  const winnersByCompetition = new Map(
    winnerCounts.map((row) => [row.competitionId, Number(row.count)])
  );

  return rows.map((row) => {
    const entry = totals.get(row.competition.id) ?? { total: 0, pending: 0 };
    return {
      competition: toView(
        row.competition,
        row.investor,
        entry.total,
        true
      ),
      applications: entry.total,
      pending: entry.pending,
      winners: winnersByCompetition.get(row.competition.id) ?? 0,
    };
  });
}

export type AdminCompetitionDetail = {
  competition: CompetitionView;
  host: {
    userId: string | null;
    name: string;
    email: string | null;
    organization: string | null;
  } | null;
  applicants: {
    id: string;
    status: CompetitionApplicationStatus;
    submittedAt: string;
    weightedScore: number | null;
    startupName: string;
    startupSlug: string;
    startupSector: string;
    startupStage: string;
  }[];
  winners: WinnerView[];
  events: CompetitionEventsRow[];
  statusCounts: Record<string, number>;
};

export async function getAdminCompetition(
  competitionId: string
): Promise<AdminCompetitionDetail | null> {
  const loaded = await loadCompetition(competitionId);
  if (!loaded) return null;

  const counts = await applicationCounts([competitionId]);

  const applicantRows = await db
    .select({ application: competitionApplications, startup: startups })
    .from(competitionApplications)
    .innerJoin(startups, eq(startups.id, competitionApplications.startupId))
    .where(eq(competitionApplications.competitionId, competitionId))
    .orderBy(desc(competitionApplications.submittedAt))
    .limit(100);

  const statusRows = await db
    .select({
      status: competitionApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(competitionApplications)
    .where(eq(competitionApplications.competitionId, competitionId))
    .groupBy(competitionApplications.status);
  const statusCounts: Record<string, number> = {};
  for (const row of statusRows) statusCounts[row.status] = Number(row.count);

  const winnerRows = await db
    .select({ winner: competitionWinners, startup: startups })
    .from(competitionWinners)
    .innerJoin(startups, eq(startups.id, competitionWinners.startupId))
    .where(eq(competitionWinners.competitionId, competitionId))
    .orderBy(asc(competitionWinners.placement));

  const eventRows = await db
    .select()
    .from(competitionEvents)
    .where(eq(competitionEvents.competitionId, competitionId))
    .orderBy(desc(competitionEvents.createdAt))
    .limit(60);

  return {
    competition: toView(
      loaded.competition,
      loaded.investor,
      counts.get(competitionId) ?? 0,
      true
    ),
    host: loaded.investor
      ? {
          userId: loaded.investor.userId,
          name: loaded.investor.fullName,
          email: null,
          organization:
            loaded.investor.firmName || loaded.competition.hostOrganization,
        }
      : null,
    applicants: applicantRows.map(({ application, startup }) => ({
      id: application.id,
      status: application.status,
      submittedAt: application.submittedAt.toISOString(),
      weightedScore: application.weightedScore
        ? Number(application.weightedScore)
        : null,
      startupName: startup.name,
      startupSlug: startup.slug,
      startupSector: startup.sector,
      startupStage: startup.stage,
    })),
    winners: winnerRows.map(({ winner, startup }) => ({
      id: winner.id,
      placement: winner.placement,
      awardLabel: winner.awardLabel,
      prizeNote: winner.prizeNote,
      status: winner.status,
      startupId: startup.id,
      startupName: startup.name,
      startupSlug: startup.slug,
      publishedAt: iso(winner.publishedAt),
    })),
    events: eventRows.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      actorRole: row.actorRole,
      createdAt: row.createdAt.toISOString(),
    })),
    statusCounts,
  };
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function inputToRow(input: CompetitionInput) {
  return {
    title: input.title || "Untitled competition",
    description: input.summary,
    fullDescription: input.description,
    sector: input.category,
    prize: input.prizeDescription,
    prizeAmount: input.prizeAmount === null ? null : Math.round(input.prizeAmount),
    prizeCurrency: input.prizeCurrency,
    benefits: input.benefits,
    bannerUrl: input.bannerUrl,
    deadline: input.deadline,
    openAt: input.openAt,
    evaluationEndsAt: input.evaluationEndsAt,
    winnerAnnouncementAt: input.winnerAnnouncementAt,
    completionAt: input.completionAt,
    eligibility: input.eligibility,
    criteria: input.criteria,
    sdgGoals: input.sdgGoals,
    sdgPrimary: input.sdgPrimary,
    rules: input.rules,
    updatedAt: new Date(),
  };
}

async function logEvent(
  tx: Tx,
  competitionId: string,
  actor: { userId: string; role: string },
  type: string,
  message: string | null
) {
  await tx.insert(competitionEvents).values({
    competitionId,
    actorUserId: actor.userId,
    actorRole: actor.role as "startup" | "investor" | "admin",
    type,
    message,
  });
}

function requireHost(
  actor: CompetitionActor,
  competition: CompetitionRow
): asserts actor is CompetitionActor & { investorId: string } {
  if (
    actor.role !== "investor" ||
    !actor.investorId ||
    competition.hostInvestorId !== actor.investorId
  ) {
    throw new CompetitionError(
      "Only the hosting investor can change this competition.",
      403,
      "NOT_HOST"
    );
  }
}

export async function createCompetitionDraft(
  actor: CompetitionActor,
  raw: unknown
): Promise<{ id: string; status: CompetitionStatus }> {
  if (actor.role !== "investor" || !actor.investorId) {
    throw new CompetitionError(
      "Only investor accounts can host competitions.",
      403,
      "ROLE_NOT_ALLOWED"
    );
  }

  const input = normalizeCompetitionInput(
    raw,
    actor.investor?.firmName || actor.investor?.fullName || null
  );
  const values = inputToRow(input);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(competitions)
      .values({
        ...values,
        hostInvestorId: actor.investorId,
        hostOrganization:
          input.hostOrganization ||
          actor.investor?.firmName ||
          actor.investor?.fullName ||
          null,
        status: "draft",
      })
      .returning({ id: competitions.id, status: competitions.status });

    if (!row) {
      throw new CompetitionError(
        "Could not save the competition draft.",
        500,
        "CREATE_FAILED"
      );
    }

    await logEvent(tx, row.id, actor, "draft_created", "Draft created.");
    return row;
  });

  return created;
}

export async function updateCompetition(
  actor: CompetitionActor,
  competitionId: string,
  raw: unknown,
  submit: boolean
): Promise<{ id: string; status: CompetitionStatus; problems: string[] }> {
  if (!isUuid(competitionId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);

    if (!competition) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }
    requireHost(actor, competition);

    if (
      competition.status !== "draft" &&
      competition.status !== "changes_requested"
    ) {
      throw new CompetitionError(
        competition.status === "approved"
          ? "This proposal is already approved. Contact an admin to make changes."
          : "This proposal can no longer be edited.",
        409,
        "NOT_EDITABLE"
      );
    }

    const input = normalizeCompetitionInput(
      raw,
      actor.investor?.firmName || actor.investor?.fullName || null
    );
    const problems = submit ? submissionProblems(input) : [];
    if (problems.length > 0) {
      return { id: competition.id, status: competition.status, problems };
    }

    const values = inputToRow(input);
    const [updated] = await tx
      .update(competitions)
      .set({
        ...values,
        hostOrganization:
          input.hostOrganization ||
          competition.hostOrganization ||
          actor.investor?.firmName ||
          null,
        status: submit ? "pending_review" : competition.status,
        submittedAt: submit ? new Date() : competition.submittedAt,
        adminFeedback: submit ? null : competition.adminFeedback,
        rejectionReason: submit ? null : competition.rejectionReason,
      })
      .where(eq(competitions.id, competition.id))
      .returning({ id: competitions.id, status: competitions.status });

    if (submit) {
      await logEvent(
        tx,
        competition.id,
        actor,
        "submitted",
        "Proposal submitted for admin review."
      );
      await notifyAdmins(tx, {
        actorUserId: actor.userId,
        type: "competition_review",
        body: `${actor.investor?.firmName || "An investor"} submitted "${values.title}" for review.`,
        competitionId: competition.id,
      });
    } else {
      await logEvent(tx, competition.id, actor, "draft_updated", "Draft saved.");
    }

    return { id: updated.id, status: updated.status, problems: [] };
  });
}

export async function adminReviewCompetition(
  actor: CompetitionActor,
  competitionId: string,
  action: "approve" | "reject" | "request_changes",
  feedback: string | null
): Promise<{ status: CompetitionStatus }> {
  if (!isUuid(competitionId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }
  const note = (feedback ?? "").trim();
  if (action !== "approve" && note.length < 5) {
    throw new CompetitionError(
      "Add a short note explaining the decision.",
      400,
      "FEEDBACK_REQUIRED"
    );
  }

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);

    if (!competition) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }
    if (competition.status !== "pending_review") {
      throw new CompetitionError(
        "Only proposals awaiting review can be decided.",
        409,
        "NOT_PENDING"
      );
    }

    const now = new Date();
    const nextStatus: CompetitionStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : "changes_requested";

    await tx
      .update(competitions)
      .set({
        status: nextStatus,
        reviewedAt: now,
        reviewedByUserId: actor.userId,
        adminFeedback: action === "request_changes" ? note : null,
        rejectionReason: action === "reject" ? note : null,
        updatedAt: now,
      })
      .where(eq(competitions.id, competitionId));

    await logEvent(
      tx,
      competitionId,
      actor,
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : "changes_requested",
      note || "Approved for publication."
    );

    const body =
      action === "approve"
        ? `Your competition "${competition.title}" was approved. Publish it when you are ready.`
        : action === "reject"
          ? `Your competition "${competition.title}" was rejected: ${note}`
          : `Changes were requested on "${competition.title}": ${note}`;

    await notifyInvestor(tx, competition.hostInvestorId, {
      actorUserId: actor.userId,
      type: "competition_review",
      body,
      competitionId,
    });

    return { status: nextStatus };
  });
}

export async function publishCompetition(
  actor: CompetitionActor,
  competitionId: string
): Promise<{ status: CompetitionStatus; notified: number }> {
  if (!isUuid(competitionId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);

    if (!competition) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }
    if (competition.status !== "approved") {
      throw new CompetitionError(
        "Only admin-approved competitions can be published.",
        409,
        "NOT_APPROVED"
      );
    }
    if (competition.publishedAt) {
      throw new CompetitionError(
        "This competition is already published.",
        409,
        "ALREADY_PUBLISHED"
      );
    }
    if (!competition.openAt || !competition.deadline) {
      throw new CompetitionError(
        "Set the opening date and deadline before publishing.",
        409,
        "DATES_REQUIRED"
      );
    }

    const now = new Date();
    const nextStatus: CompetitionStatus =
      competition.openAt > now ? "scheduled" : "open";

    await tx
      .update(competitions)
      .set({
        publishedAt: now,
        status: nextStatus,
        updatedAt: now,
        reviewedAt: competition.reviewedAt ?? now,
        reviewedByUserId: competition.reviewedByUserId ?? actor.userId,
      })
      .where(eq(competitions.id, competitionId));

    const hostInvestor = competition.hostInvestorId
      ? (
          await tx
            .select()
            .from(investors)
            .where(eq(investors.id, competition.hostInvestorId))
            .limit(1)
        )[0] ?? null
      : null;

    const notified = await notifyStartupsOfPublication(
      tx,
      {
        id: competition.id,
        title: competition.title,
        sector: competition.sector,
        deadline: competition.deadline,
        prize: competition.prize,
        eligibility: competition.eligibility,
      },
      competition.hostOrganization || hostLabel(hostInvestor),
      prizeLabel({
        prizeAmount: competition.prizeAmount,
        prizeCurrency: competition.prizeCurrency,
        prize: competition.prize,
      })
    );

    await logEvent(
      tx,
      competitionId,
      actor,
      "published",
      `Published (${nextStatus}); ${notified} startups notified.`
    );

    return { status: nextStatus, notified };
  });
}

export async function adminAdvanceCompetition(
  actor: CompetitionActor,
  competitionId: string,
  action: "start_evaluation" | "complete"
): Promise<{ status: CompetitionStatus }> {
  if (!isUuid(competitionId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);
    if (!competition) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }

    if (action === "start_evaluation") {
      if (
        competition.status !== "closed" &&
        competition.status !== "open"
      ) {
        throw new CompetitionError(
          "Only closed competitions can move into evaluation.",
          409,
          "INVALID_TRANSITION"
        );
      }
      const now = new Date();
      await tx
        .update(competitions)
        .set({ status: "under_evaluation", updatedAt: now })
        .where(eq(competitions.id, competitionId));
      await logEvent(
        tx,
        competitionId,
        actor,
        "evaluation_started",
        "Evaluation started."
      );
      return { status: "under_evaluation" };
    }

    if (competition.winnerAnnouncementStatus !== "approved") {
      throw new CompetitionError(
        "Winner announcements must be approved before completing.",
        409,
        "WINNERS_NOT_APPROVED"
      );
    }
    const now = new Date();
    await tx
      .update(competitions)
      .set({
        status: "completed",
        completionAt: now,
        updatedAt: now,
      })
      .where(eq(competitions.id, competitionId));
    await logEvent(tx, competitionId, actor, "completed", "Competition completed.");
    return { status: "completed" };
  });
}

export async function applyToCompetition(
  actor: CompetitionActor,
  competitionId: string,
  rawCoverNote: string | null
): Promise<{ id: string }> {
  if (actor.role !== "startup" || !actor.startupId || !actor.startup) {
    throw new CompetitionError(
      "Only startup accounts can apply to competitions.",
      403,
      "ROLE_NOT_ALLOWED"
    );
  }
  if (!isUuid(competitionId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }

  const coverNote = (rawCoverNote ?? "").trim().slice(0, 2000) || null;

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);

    if (!competition || !competition.publishedAt) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }
    if (!acceptsApplications(competition)) {
      throw new CompetitionError(
        phaseOf(competition) === "upcoming"
          ? "Applications have not opened yet."
          : "Applications are closed for this competition.",
        409,
        "NOT_ACCEPTING"
      );
    }

    // Verified-impact requirements are checked against the current claim, so
    // a stale or pending claim can never satisfy an eligibility rule.
    const [impactClaim] = await tx
      .select()
      .from(startupImpactClaims)
      .where(eq(startupImpactClaims.startupId, actor.startupId!))
      .limit(1);
    const eligibility = evaluateEligibility(
      actor.startup,
      competition.eligibility,
      { status: effectiveImpactStatus(actor.startup!, impactClaim) }
    );
    if (eligibility.status === "ineligible" || eligibility.status === "needs_info") {
      throw new CompetitionError(
        eligibility.reasons.join(" "),
        409,
        eligibility.status === "ineligible"
          ? "NOT_ELIGIBLE"
          : "PROFILE_INCOMPLETE"
      );
    }

    const [application] = await tx
      .insert(competitionApplications)
      .values({
        competitionId,
        startupId: actor.startupId!,
        submittedByUserId: actor.userId,
        status: "submitted",
        coverNote,
        snapshot: {
          name: actor.startup!.name,
          slug: actor.startup!.slug,
          tagline: actor.startup!.tagline,
          sector: actor.startup!.sector,
          stage: actor.startup!.stage,
          location: actor.startup!.location,
          mrr: actor.startup!.mrr,
          score: actor.startup!.score ? Number(actor.startup!.score) : null,
          sdgGoals: actor.startup!.sdgGoals ?? [],
          sdgPrimary: actor.startup!.sdgPrimary ?? null,
        },
      })
      .onConflictDoNothing()
      .returning({ id: competitionApplications.id });

    if (!application) {
      throw new CompetitionError(
        "Your startup has already applied to this competition.",
        409,
        "DUPLICATE_APPLICATION"
      );
    }

    await logEvent(
      tx,
      competitionId,
      actor,
      "application_submitted",
      `${actor.startup!.name} applied.`
    );

    await notifyInvestor(tx, competition.hostInvestorId, {
      actorUserId: actor.userId,
      type: "competition_application",
      body: `${actor.startup!.name} applied to "${competition.title}".`,
      competitionId,
      applicationId: application.id,
    });

    return { id: application.id };
  });
}

export async function withdrawApplication(
  actor: CompetitionActor,
  applicationId: string
): Promise<{ status: CompetitionApplicationStatus }> {
  if (actor.role !== "startup" || !actor.startupId) {
    throw new CompetitionError("Not allowed.", 403, "ROLE_NOT_ALLOWED");
  }
  if (!isUuid(applicationId)) {
    throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        application: competitionApplications,
        competition: competitions,
      })
      .from(competitionApplications)
      .innerJoin(
        competitions,
        eq(competitions.id, competitionApplications.competitionId)
      )
      .where(eq(competitionApplications.id, applicationId))
      .for("update")
      .limit(1);

    if (!row || row.application.startupId !== actor.startupId) {
      throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
    }
    if (!acceptsApplications(row.competition)) {
      throw new CompetitionError(
        "Applications are closed; you can no longer withdraw.",
        409,
        "NOT_ACCEPTING"
      );
    }
    if (!["submitted", "under_review", "shortlisted"].includes(row.application.status)) {
      throw new CompetitionError(
        "This application can no longer be withdrawn.",
        409,
        "INVALID_TRANSITION"
      );
    }

    const now = new Date();
    await tx
      .update(competitionApplications)
      .set({ status: "withdrawn", updatedAt: now })
      .where(eq(competitionApplications.id, applicationId));

    await logEvent(
      tx,
      row.competition.id,
      actor,
      "application_withdrawn",
      "An application was withdrawn."
    );

    return { status: "withdrawn" };
  });
}

export async function evaluateApplication(
  actor: CompetitionActor,
  applicationId: string,
  rawScores: unknown,
  rawNotes: string | null
): Promise<{ weightedScore: number }> {
  if (actor.role !== "investor") {
    throw new CompetitionError("Not allowed.", 403, "NOT_HOST");
  }
  if (!isUuid(applicationId)) {
    throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        application: competitionApplications,
        competition: competitions,
      })
      .from(competitionApplications)
      .innerJoin(
        competitions,
        eq(competitions.id, competitionApplications.competitionId)
      )
      .where(eq(competitionApplications.id, applicationId))
      .limit(1);

    if (!row) {
      throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
    }
    requireHost(actor, row.competition);

    if (row.application.status === "withdrawn") {
      throw new CompetitionError(
        "This application was withdrawn.",
        409,
        "WITHDRAWN"
      );
    }

    const criteria = row.competition.criteria ?? [];
    if (criteria.length === 0) {
      throw new CompetitionError(
        "This competition has no evaluation criteria.",
        409,
        "NO_CRITERIA"
      );
    }

    const scoresRaw = (rawScores ?? {}) as Record<string, unknown>;
    const scores: Record<string, number> = {};
    for (const criterion of criteria) {
      const value = Number(scoresRaw[criterion.key]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new CompetitionError(
          `Score "${criterion.label}" must be between 0 and 100.`,
          400,
          "INVALID_SCORE"
        );
      }
      scores[criterion.key] = Math.round(value);
    }

    const totalWeight = criteria.reduce((sum, entry) => sum + entry.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new CompetitionError(
        "Evaluation weights are misconfigured for this competition.",
        409,
        "INVALID_CRITERIA"
      );
    }

    const weighted =
      Math.round(
        criteria.reduce(
          (sum, criterion) =>
            sum + (scores[criterion.key] ?? 0) * criterion.weight,
          0
        ) * 100
      ) / 10000;
    const weightedScore = Math.round(weighted * 100) / 100;

    await tx
      .insert(competitionEvaluations)
      .values({
        applicationId,
        evaluatorUserId: actor.userId,
        scores,
        weightedScore: weightedScore.toFixed(2),
        notes: (rawNotes ?? "").trim().slice(0, 4000) || null,
      })
      .onConflictDoUpdate({
        target: [
          competitionEvaluations.applicationId,
          competitionEvaluations.evaluatorUserId,
        ],
        set: {
          scores,
          weightedScore: weightedScore.toFixed(2),
          notes: (rawNotes ?? "").trim().slice(0, 4000) || null,
          updatedAt: new Date(),
        },
      });

    const [average] = await tx
      .select({
        avg: sql<string | null>`avg(${competitionEvaluations.weightedScore})`,
      })
      .from(competitionEvaluations)
      .where(eq(competitionEvaluations.applicationId, applicationId));

    if (average?.avg) {
      await tx
        .update(competitionApplications)
        .set({
          weightedScore: Number(average.avg).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(competitionApplications.id, applicationId));
    }

    return { weightedScore };
  });
}

const DECIDABLE: CompetitionApplicationStatus[] = [
  "under_review",
  "shortlisted",
  "accepted",
  "rejected",
];

export async function setApplicationStatus(
  actor: CompetitionActor,
  applicationId: string,
  nextStatus: string
): Promise<{ status: CompetitionApplicationStatus }> {
  if (!DECIDABLE.includes(nextStatus as CompetitionApplicationStatus)) {
    throw new CompetitionError(
      "Choose a valid application status.",
      400,
      "INVALID_STATUS"
    );
  }
  if (!isUuid(applicationId)) {
    throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        application: competitionApplications,
        competition: competitions,
        startup: startups,
      })
      .from(competitionApplications)
      .innerJoin(
        competitions,
        eq(competitions.id, competitionApplications.competitionId)
      )
      .innerJoin(startups, eq(startups.id, competitionApplications.startupId))
      .where(eq(competitionApplications.id, applicationId))
      .limit(1);

    if (!row) {
      throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
    }
    requireHost(actor, row.competition);

    if (row.application.status === "withdrawn") {
      throw new CompetitionError(
        "This application was withdrawn.",
        409,
        "WITHDRAWN"
      );
    }

    const status = nextStatus as CompetitionApplicationStatus;
    const now = new Date();
    await tx
      .update(competitionApplications)
      .set({
        status,
        updatedAt: now,
        decidedAt:
          status === "accepted" || status === "rejected"
            ? now
            : row.application.decidedAt,
      })
      .where(eq(competitionApplications.id, applicationId));

    await logEvent(
      tx,
      row.competition.id,
      actor,
      `application_${status}`,
      `${row.startup.name} moved to ${APPLICATION_STATUS_LABELS[status] ?? status}.`
    );

    await notifyStartup(tx, row.application.startupId, {
      actorUserId: actor.userId,
      type: "competition_application_status",
      body: `Your application to "${row.competition.title}" is now ${APPLICATION_STATUS_LABELS[status] ?? status}.`,
      competitionId: row.competition.id,
      applicationId,
    });

    return { status };
  });
}

export async function proposeWinner(
  actor: CompetitionActor,
  competitionId: string,
  applicationId: string,
  placement: number,
  awardLabel: string | null,
  prizeNote: string | null
): Promise<{ id: string }> {
  if (!isUuid(competitionId) || !isUuid(applicationId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }
  const place = Math.trunc(Number(placement));
  if (!Number.isFinite(place) || place < 1 || place > 20) {
    throw new CompetitionError(
      "Placement must be between 1 and 20.",
      400,
      "INVALID_PLACEMENT"
    );
  }

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);

    if (!competition) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }
    requireHost(actor, competition);

    if (!competition.publishedAt) {
      throw new CompetitionError(
        "Publish the competition before proposing winners.",
        409,
        "NOT_PUBLISHED"
      );
    }
    if (
      phaseOf(competition) === "open" ||
      phaseOf(competition) === "upcoming"
    ) {
      throw new CompetitionError(
        "Winners can be proposed after applications close.",
        409,
        "STILL_OPEN"
      );
    }

    const [application] = await tx
      .select()
      .from(competitionApplications)
      .where(
        and(
          eq(competitionApplications.id, applicationId),
          eq(competitionApplications.competitionId, competitionId)
        )
      )
      .limit(1);

    if (!application) {
      throw new CompetitionError("Application not found.", 404, "NOT_FOUND");
    }
    if (application.status === "withdrawn") {
      throw new CompetitionError(
        "Withdrawn applications cannot win.",
        409,
        "WITHDRAWN"
      );
    }

    const [existing] = await tx
      .select()
      .from(competitionWinners)
      .where(
        and(
          eq(competitionWinners.competitionId, competitionId),
          eq(competitionWinners.startupId, application.startupId)
        )
      )
      .limit(1);

    let winnerId: string;
    if (existing) {
      const [updated] = await tx
        .update(competitionWinners)
        .set({
          applicationId,
          placement: place,
          awardLabel: awardLabel?.trim().slice(0, 120) || null,
          prizeNote: prizeNote?.trim().slice(0, 500) || null,
          status: "proposed",
          proposedByUserId: actor.userId,
          proposedAt: new Date(),
          reviewedByUserId: null,
          reviewedAt: null,
          adminNote: null,
          publishedAt: null,
        })
        .where(eq(competitionWinners.id, existing.id))
        .returning({ id: competitionWinners.id });
      winnerId = updated.id;
    } else {
      const [inserted] = await tx
        .insert(competitionWinners)
        .values({
          competitionId,
          applicationId,
          startupId: application.startupId,
          placement: place,
          awardLabel: awardLabel?.trim().slice(0, 120) || null,
          prizeNote: prizeNote?.trim().slice(0, 500) || null,
          status: "proposed",
          proposedByUserId: actor.userId,
        })
        .returning({ id: competitionWinners.id });
      winnerId = inserted.id;
    }

    await tx
      .update(competitions)
      .set({
        winnerAnnouncementStatus: "pending_approval",
        winnerAnnouncementApprovedAt: null,
        winnerAnnouncementApprovedByUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(competitions.id, competitionId));

    await logEvent(
      tx,
      competitionId,
      actor,
      "winner_proposed",
      `Proposed placement #${place}.`
    );

    await notifyAdmins(tx, {
      actorUserId: actor.userId,
      type: "competition_winner_proposed",
      body: `A winner was proposed for "${competition.title}" and needs approval.`,
      competitionId,
    });

    return { id: winnerId };
  }).catch((error) => {
    if (sqlStateOf(error) === "23505") {
      throw new CompetitionError(
        "That placement is already assigned to another startup.",
        409,
        "PLACEMENT_TAKEN"
      );
    }
    throw error;
  });
}

export async function removeWinner(
  actor: CompetitionActor,
  winnerId: string
): Promise<{ ok: true }> {
  if (!isUuid(winnerId)) {
    throw new CompetitionError("Winner not found.", 404, "NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ winner: competitionWinners, competition: competitions })
      .from(competitionWinners)
      .innerJoin(
        competitions,
        eq(competitions.id, competitionWinners.competitionId)
      )
      .where(eq(competitionWinners.id, winnerId))
      .limit(1);

    if (!row) {
      throw new CompetitionError("Winner not found.", 404, "NOT_FOUND");
    }
    requireHost(actor, row.competition);

    if (row.winner.status === "approved") {
      throw new CompetitionError(
        "Approved winners cannot be removed.",
        409,
        "ALREADY_APPROVED"
      );
    }

    await tx
      .delete(competitionWinners)
      .where(eq(competitionWinners.id, winnerId));

    const [remaining] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(competitionWinners)
      .where(eq(competitionWinners.competitionId, row.competition.id));

    if (Number(remaining?.count ?? 0) === 0) {
      await tx
        .update(competitions)
        .set({ winnerAnnouncementStatus: "none", updatedAt: new Date() })
        .where(eq(competitions.id, row.competition.id));
    }

    await logEvent(
      tx,
      row.competition.id,
      actor,
      "winner_removed",
      "A proposed winner was removed."
    );

    return { ok: true as const };
  });
}

export async function adminDecideWinnerAnnouncement(
  actor: CompetitionActor,
  competitionId: string,
  action: "approve" | "request_changes",
  note: string | null
): Promise<{ status: string }> {
  if (!isUuid(competitionId)) {
    throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
  }
  const feedback = (note ?? "").trim();
  if (action === "request_changes" && feedback.length < 5) {
    throw new CompetitionError(
      "Explain what needs to change before approval.",
      400,
      "FEEDBACK_REQUIRED"
    );
  }

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);

    if (!competition) {
      throw new CompetitionError("Competition not found.", 404, "NOT_FOUND");
    }
    if (competition.winnerAnnouncementStatus !== "pending_approval") {
      throw new CompetitionError(
        "There is no winner announcement awaiting approval.",
        409,
        "NOT_PENDING"
      );
    }

    const winners = await tx
      .select({ winner: competitionWinners, startup: startups })
      .from(competitionWinners)
      .innerJoin(startups, eq(startups.id, competitionWinners.startupId))
      .where(eq(competitionWinners.competitionId, competitionId));

    if (winners.length === 0) {
      throw new CompetitionError(
        "No winners have been proposed.",
        409,
        "NO_WINNERS"
      );
    }

    const now = new Date();

    if (action === "request_changes") {
      await tx
        .update(competitionWinners)
        .set({
          status: "changes_requested",
          reviewedByUserId: actor.userId,
          reviewedAt: now,
          adminNote: feedback,
        })
        .where(eq(competitionWinners.competitionId, competitionId));

      await tx
        .update(competitions)
        .set({
          winnerAnnouncementStatus: "changes_requested",
          updatedAt: now,
        })
        .where(eq(competitions.id, competitionId));

      await logEvent(
        tx,
        competitionId,
        actor,
        "winner_changes_requested",
        feedback
      );

      await notifyInvestor(tx, competition.hostInvestorId, {
        actorUserId: actor.userId,
        type: "competition_review",
        body: `Changes were requested on the winner announcement for "${competition.title}": ${feedback}`,
        competitionId,
      });

      return { status: "changes_requested" };
    }

    await tx
      .update(competitionWinners)
      .set({
        status: "approved",
        reviewedByUserId: actor.userId,
        reviewedAt: now,
        publishedAt: now,
        adminNote: feedback || null,
      })
      .where(eq(competitionWinners.competitionId, competitionId));      await tx
        .update(competitions)
        .set({
          winnerAnnouncementStatus: "approved",
          winnerAnnouncementApprovedAt: now,
          winnerAnnouncementApprovedByUserId: actor.userId,
          status: "completed",
          // The completion date is when results went public, not the
          // optimistic date the investor planned at proposal time.
          completionAt: now,
          updatedAt: now,
        })
        .where(eq(competitions.id, competitionId));

    await logEvent(
      tx,
      competitionId,
      actor,
      "winner_approved",
      "Winner announcement approved and published."
    );

    await notifyInvestor(tx, competition.hostInvestorId, {
      actorUserId: actor.userId,
      type: "competition_winner_announced",
      body: `The winner announcement for "${competition.title}" was approved and is now public.`,
      competitionId,
    });

    for (const { winner, startup } of winners) {
      await notifyStartup(tx, startup.id, {
        actorUserId: actor.userId,
        type: "competition_winner_announced",
        body: `Congratulations — ${startup.name} placed #${winner.placement} in "${competition.title}".`,
        competitionId,
      });
    }

    return { status: "approved" };
  });
}
