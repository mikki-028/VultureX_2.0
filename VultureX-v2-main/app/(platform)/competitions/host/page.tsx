import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
// Icons passed as props to client components must cross a client boundary.
import { Trophy } from "@/components/competitions/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCompetitionActor } from "@/features/competitions";
import { EMPTY_COMPETITION_FORM } from "@/features/competitions/form-defaults";
import { CompetitionForm } from "./competition-form";

export const metadata = { title: "Host a competition" };

export default async function HostCompetitionPage() {
  const actor = await getCompetitionActor();
  if (!actor) redirect("/login?callbackUrl=/competitions/host");
  if (actor.role !== "investor") redirect("/competitions?tab=host");

  return (
    <div className="max-w-4xl">
      <Link
        href="/competitions?tab=host"
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-4 transition-colors"
      >
        <ArrowLeft size={11} /> Back to competitions
      </Link>

      <PageHeader
        title="Propose a competition"
        subtitle="Drafts stay private. The VultureX team reviews every proposal before it is published to startups."
      />

      {!actor.investorId ? (
        <EmptyState
          icon={Trophy}
          title="Complete your investor profile first"
          description="Your organisation and focus areas are used on the competition page."
          action={{ label: "Set up investor profile", href: "/onboarding/investor" }}
        />
      ) : (
        <CompetitionForm
          initial={{
            ...EMPTY_COMPETITION_FORM,
            hostOrganization:
              actor.investor?.firmName || actor.investor?.fullName || "",
          }}
        />
      )}
    </div>
  );
}
