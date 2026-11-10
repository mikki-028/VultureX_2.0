import type { Metadata } from "next";
import { auth } from "@/features/auth";
import { db } from "@/db";
import {
  competitionEntries,
  competitions,
  decks,
  interests,
  profileViews,
  startups,
} from "@/db/schema";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { getRecommendationSummary } from "@/features/matchmaking";
import { SDG_GOALS } from "@/features/sdg/taxonomy";
import {
  AccountPanel,
  AlertPanel,
  CommunityPanel,
  FounderProgress,
  FounderTopBar,
  ImpactPanel,
  LearningPanel,
  MetricsPanel,
  NextActions,
  OpportunitiesPanel,
  WelcomeCard,
  type FounderAction,
  type FounderMetric,
  type OpportunityItem,
} from "@/components/knowledge-hub/founder";
import { ForYouBottomNav } from "@/components/knowledge-hub/founder/ForYouBottomNav";
import { getFounderProfile } from "@/features/founder-profile";
import { getRequestLocale } from "@/features/i18n/server";
import { translatorFor } from "@/features/i18n/messages";
import { loadRoadmap } from "@/features/roadmap";
import type { RoadmapOverview } from "@/features/roadmap/types";
import { RoadmapSummary } from "@/components/knowledge-hub/roadmap/RoadmapSummary";
import { WorkspaceTools } from "@/components/knowledge-hub/founder/WorkspaceTools";
import { getReminderSummary } from "@/features/reminders";
import type { ReminderSummary } from "@/features/reminders/types";
import { getSavedResourceCount } from "@/features/saved-resources";
import {
  CHALLENGES,
  CHALLENGE_HUB_LINKS,
  OBJECTIVES,
  languageLabel,
  optionLabel,
} from "@/features/founder-profile/options";

export const metadata: Metadata = {
  title: "For You",
  description: "Your founder workspace: next actions, learning, metrics and opportunities.",
};

// Reads the signed-in founder's own records; never cached across accounts.
export const dynamic = "force-dynamic";

type FounderView = {
  name: string;
  stage: string | null;
  tagline: string | null;
  sector: string | null;
  slug: string;
  actions: FounderAction[];
  metrics: FounderMetric[];
  opportunities: OpportunityItem[];
  goals: string[];
  objective: string | null;
  language: string | null;
  profileReady: boolean;
  roadmap: RoadmapOverview | null;
  savedCount: number;
  reminders: ReminderSummary;
};

function readableStage(stage: string): string {
  return stage
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function ForYouPage() {
  const session = await auth();
  const locale = await getRequestLocale();
  const t = translatorFor(locale);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const signedIn = Boolean(session?.user);

  let founder: FounderView | null = null;

  if (userId && role === "startup") {
    const [startup] = await db
      .select()
      .from(startups)
      .where(eq(startups.userId, userId))
      .limit(1);

    if (startup) {
      const [viewCount, interestCount, deckCount, entryCount, recommendations, opportunities] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(profileViews)
            .where(
              and(
                eq(profileViews.startupId, startup.id),
                sql`viewed_at > now() - interval '30 days'`
              )
            )
            .then((rows) => rows[0]),
          db
            .select({ count: sql<number>`count(*)` })
            .from(interests)
            .where(eq(interests.startupId, startup.id))
            .then((rows) => rows[0]),
          db
            .select({ count: sql<number>`count(*)` })
            .from(decks)
            .where(eq(decks.startupId, startup.id))
            .then((rows) => rows[0]),
          db
            .select({ count: sql<number>`count(*)` })
            .from(competitionEntries)
            .where(eq(competitionEntries.startupId, startup.id))
            .then((rows) => rows[0]),
          getRecommendationSummary(startup.id, 3).catch((error) => {
            console.error("Failed to load For You recommendations:", error);
            return null;
          }),
          db
            .select({
              id: competitions.id,
              title: competitions.title,
              status: competitions.status,
              deadline: competitions.deadline,
            })
            .from(competitions)
            .where(
              and(
                inArray(competitions.status, ["open", "scheduled"]),
                gte(competitions.deadline, new Date())
              )
            )
            .orderBy(asc(competitions.deadline))
            .limit(3),
        ]);

      const views = Number(viewCount.count);
      const interestTotal = Number(interestCount.count);
      const deckTotal = Number(deckCount.count);
      const entryTotal = Number(entryCount.count);
      const founderProfile = await getFounderProfile(userId);
      const roadmap = await loadRoadmap(userId, startup.id, startup.stage).catch((error) => {
        console.error("Failed to load For You roadmap:", error);
        return null;
      });
      const [savedCount, reminderSummary] = await Promise.all([
        getSavedResourceCount(userId),
        getReminderSummary(userId),
      ]);

      const missingStory = [
        !startup.tagline ? "tagline" : null,
        !startup.problem ? "problem" : null,
        !startup.solution ? "solution" : null,
      ].filter((field): field is string => Boolean(field));

      const actions: FounderAction[] = [];

      if (missingStory.length > 0) {
        actions.push({
          title: "Complete your startup story",
          description:
            "Investors and partners read your profile before they reply. Fill in the fields that are still empty.",
          why: `Your profile is missing: ${missingStory.join(", ")}.`,
          priority: "High",
          time: "~10 min",
          category: "Profile",
          href: "/settings",
          cta: "Edit profile",
        });
      }

      if (deckTotal === 0) {
        actions.push({
          title: "Prepare your first pitch deck",
          description:
            "Build the deck investors can request, and keep control of who sees it.",
          why: "No pitch deck is stored on your startup profile yet.",
          priority: "Medium",
          time: "~45 min",
          category: "Documents",
          href: "/pitch-decks",
          cta: "Open pitch decks",
        });
      }

      if (interestTotal > 0) {
        actions.push({
          title: "Respond to investor interest",
          description:
            "Investors have already raised their hand. Reply while the context is still fresh.",
          why: `${interestTotal} investor ${interestTotal === 1 ? "interest is" : "interests are"} recorded against your startup.`,
          priority: "High",
          time: "~5 min",
          category: "Investors",
          href: "/interests",
          cta: "View interests",
        });
      }

      if (recommendations && recommendations.total > 0) {
        actions.push({
          title: `Review ${recommendations.total} business ${recommendations.total === 1 ? "match" : "matches"}`,
          description:
            "Startups whose offerings and needs line up with yours, scored on your saved profile.",
          why: `${recommendations.total} persisted ${recommendations.total === 1 ? "match is" : "matches are"} waiting in Discover.`,
          priority: "Medium",
          time: "~15 min",
          category: "Collaboration",
          href: "/discover",
          cta: "Open matches",
        });
      }

      if (entryTotal === 0) {
        actions.push({
          title: "Enter a startup competition",
          description:
            "Competitions are the shortest route to investor visibility and structured feedback.",
          why: "You have not entered a competition on VultureX yet.",
          priority: "Medium",
          time: "~30 min",
          category: "Opportunity",
          href: "/competitions",
          cta: "Browse competitions",
        });
      }

      // Roadmap actions come from persisted tasks and milestones only.
      if (roadmap) {
        const primaryRecommendation = roadmap.recommendations[0];

        if (roadmap.tasks.length === 0) {
          actions.push({
            title: `Build your ${roadmap.stage.label} roadmap`,
            description:
              "Add the suggested stage checklist, then track only the tasks you actually start or complete.",
            why: `No roadmap tasks exist yet for your saved ${roadmap.stage.label} stage.`,
            priority: "High",
            time: "~10 min",
            category: "Roadmap",
            href: "/knowledge-hub/roadmap",
            cta: "Build roadmap",
          });
        } else if (primaryRecommendation?.kind === "next_task") {
          actions.push({
            title: `Continue roadmap: ${primaryRecommendation.title}`,
            description: primaryRecommendation.description,
            why: primaryRecommendation.why,
            priority: "High",
            time: "~15 min",
            category: "Roadmap",
            href: primaryRecommendation.taskId
              ? `/knowledge-hub/roadmap#task-${primaryRecommendation.taskId}`
              : "/knowledge-hub/roadmap",
            cta: "Open task",
          });
        } else if (primaryRecommendation?.kind === "stage_task") {
          actions.push({
            title: "Extend your stage roadmap",
            description: primaryRecommendation.description,
            why: primaryRecommendation.why,
            priority: "Medium",
            time: "~5 min",
            category: "Roadmap",
            href: "/knowledge-hub/roadmap",
            cta: "Open roadmap",
          });
        } else if (primaryRecommendation?.kind === "milestone") {
          actions.push({
            title: "Add a roadmap milestone",
            description: primaryRecommendation.description,
            why: primaryRecommendation.why,
            priority: "Medium",
            time: "~5 min",
            category: "Roadmap",
            href: "/knowledge-hub/roadmap#milestones",
            cta: "Add milestone",
          });
        }
      }

      if (reminderSummary.overdue > 0) {
        actions.push({
          title: `Review ${reminderSummary.overdue} overdue ${reminderSummary.overdue === 1 ? "reminder" : "reminders"}`,
          description:
            "Follow up on the reminders that are already past their due time. Completing a reminder does not change its linked task.",
          why: `${reminderSummary.overdue} reminder ${reminderSummary.overdue === 1 ? "is" : "are"} past due in your workspace.`,
          priority: "High",
          time: "~5 min",
          category: "Reminders",
          href: "/knowledge-hub/for-you/reminders",
          cta: "Open reminders",
        });
      }

      // Personalisation actions come from data the founder saved themselves.
      // They never invent a stage, challenge or eligibility result.
      if (!founderProfile?.onboardingCompletedAt) {
        actions.push({
          title: "Personalise your founder workspace",
          description:
            "Save your objective, challenges and interests so For You points at the sections that match your current stage.",
          why: founderProfile
            ? "Founder preferences are saved, but onboarding has not been completed."
            : "No founder preferences have been saved for this account yet.",
          priority: "High",
          time: "~4 min",
          category: "Profile",
          href: "/onboarding/founder",
          cta: "Personalise workspace",
        });
      } else {
        const primaryChallenge = founderProfile.challenges[0];
        const challengeName = optionLabel(CHALLENGES, primaryChallenge);
        const challengeHref = primaryChallenge
          ? CHALLENGE_HUB_LINKS[primaryChallenge]
          : undefined;

        if (challengeName && challengeHref) {
          actions.push({
            title: `Get guidance on ${challengeName.toLowerCase()}`,
            description:
              "A Knowledge Hub section chosen from the challenge you saved on your founder profile.",
            why: `You listed “${challengeName}” as a current challenge.`,
            priority: "High",
            time: "~10 min",
            category: "Guidance",
            href: challengeHref,
            cta: "Open guide",
          });
        }
      }

      const orderedActions = actions
        .sort((a, b) =>
          a.priority === b.priority ? 0 : a.priority === "High" ? -1 : 1
        )
        .slice(0, 3);

      const goals = (startup.sdgGoals ?? [])
        .map((id) => SDG_GOALS.find((goal) => goal.id === id)?.shortName)
        .filter((goal): goal is string => Boolean(goal))
        .slice(0, 3);

      founder = {
        name: session.user?.name ?? startup.founderName ?? startup.name,
        stage: startup.stage ? readableStage(startup.stage) : null,
        tagline: startup.tagline,
        sector: startup.sector,
        slug: startup.slug,
        actions: orderedActions,
        metrics: [
          { label: t("foryou.profileViews"), value: views, hint: t("foryou.last30") },
          { label: t("foryou.investorInterests"), value: interestTotal, hint: t("foryou.allTime") },
          { label: t("foryou.pitchDecksStored"), value: deckTotal, hint: t("foryou.stored") },
        ],
        opportunities: opportunities.map((opportunity) => ({
          id: opportunity.id,
          title: opportunity.title,
          status: opportunity.status,
          deadline: opportunity.deadline,
        })),
        goals,
        objective: optionLabel(OBJECTIVES, founderProfile?.currentObjective),
        language: founderProfile ? languageLabel(founderProfile.preferredLanguage) : null,
        profileReady: Boolean(founderProfile?.onboardingCompletedAt),
        roadmap,
        savedCount,
        reminders: reminderSummary,
      };
    }
  }

  const displayName = founder?.name ?? session?.user?.name ?? null;
  const initial = (displayName?.charAt(0) ?? "V").toUpperCase();
  const profileHref = founder
    ? `/explore/${founder.slug}`
    : signedIn
      ? "/settings"
      : "/login";

  const accountPanel = !signedIn ? (
    <AccountPanel
      title="Sign in to open your founder workspace"
      description="For You reads your stage, profile gaps, pitch decks and business matches from your own account. The Knowledge Hub itself stays open to everyone."
      primary={{ label: "Sign in", href: "/login" }}
      secondary={{ label: "Create an account", href: "/signup" }}
    />
  ) : role === "startup" ? (
    <AccountPanel
      title="Set up your startup profile"
      description="This account has no startup profile to read yet. Create it once and For You fills in with your real stage, metrics and recommendations."
      primary={{ label: "Create startup profile", href: "/onboarding/startup" }}
      secondary={{ label: "Browse the Knowledge Hub", href: "/knowledge-hub" }}
    />
  ) : role === "investor" ? (
    <AccountPanel
      title="For You is tuned for founders"
      description="Your investor dashboard holds saved startups, expressed interests and messages. The founder workspace becomes personalised when a startup profile is attached to the account."
      primary={{ label: "Open your dashboard", href: "/dashboard" }}
      secondary={{ label: "Browse startups", href: "/explore" }}
    />
  ) : (
    <AccountPanel
      title="For You is tuned for founders"
      description="Administrator accounts review pitch decks and impact claims. Founder actions and metrics belong to startup accounts."
      primary={{ label: "Open admin dashboard", href: "/admin" }}
      secondary={{ label: "Browse the Knowledge Hub", href: "/knowledge-hub" }}
    />
  );

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 md:pb-0">
      <FounderTopBar stage={founder?.stage ?? null} initial={initial} profileHref={profileHref} locale={locale} />

      <div className="space-y-4">
        <WelcomeCard
          name={displayName}
          stage={founder?.stage ?? null}
          tagline={founder?.tagline ?? null}
          sector={founder?.sector ?? null}
          signedIn={signedIn}
          profileHref={founder ? `/explore/${founder.slug}` : null}
          objective={founder?.objective ?? null}
          language={founder?.language ?? null}
          editProfileHref={founder ? "/knowledge-hub/for-you/profile" : null}
          locale={locale}
        />

        {founder ? (
          <>
            <FounderProgress stage={founder.stage} locale={locale} />
            {founder.roadmap && <RoadmapSummary roadmap={founder.roadmap} />}
            <WorkspaceTools savedCount={founder.savedCount} reminders={founder.reminders} locale={locale} />
            <NextActions actions={founder.actions} locale={locale} />

            <div className="grid gap-4 md:grid-cols-2">
              <LearningPanel items={[]} locale={locale} />
              <MetricsPanel metrics={founder.metrics} locale={locale} />
            </div>

            <OpportunitiesPanel items={founder.opportunities} locale={locale} />

            <div className="grid gap-4 md:grid-cols-2">
              <CommunityPanel locale={locale} />
              <AlertPanel locale={locale} />
            </div>

            <ImpactPanel goals={founder.goals} locale={locale} />
          </>
        ) : (
          <>
            {accountPanel}

            <div className="grid gap-4 md:grid-cols-2">
              <CommunityPanel locale={locale} />
              <AlertPanel locale={locale} />
            </div>

            <ImpactPanel goals={[]} locale={locale} />
          </>
        )}
      </div>

      <ForYouBottomNav />
    </div>
  );
}
