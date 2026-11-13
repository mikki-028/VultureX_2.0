import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { startups, investors, interests } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { HeroSection } from "./hero";
import { FeatureGrid } from "./features";
import { StartupTable } from "./startup-table";
import { SdgSection } from "./sdg-section";

// Don't prerender at build time - DB is in a different region than build server
export const dynamic = "force-dynamic";

/**
 * Requested company metric for the homepage investor statistic.
 *
 * The hero only prints a number when the verified investor records support it.
 * Above this threshold the live count is shown (58 when there are 58 records,
 * the real larger figure once there are more); below it the hero shows the
 * honest "Growing Investor Network" label instead of a fabricated number.
 */
const VERIFIED_INVESTOR_METRIC = 58;

export default async function HomePage() {
  // Run all queries in parallel
  const [startupCount, investorCount, connectionCount, topStartups] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(startups).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(investors).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(interests).then(r => r[0]),
    db.select().from(startups).orderBy(desc(startups.score)).limit(6),
  ]);

  const investorTotal = Number(investorCount.count);

  return (
    <div>
      <HeroSection
        stats={{
          startups: Number(startupCount.count),
          investors: investorTotal >= VERIFIED_INVESTOR_METRIC ? investorTotal : null,
          connections: Number(connectionCount.count),
        }}
      />
      <FeatureGrid />
      <StartupTable startups={topStartups.map(s => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        tagline: s.tagline,
        sector: s.sector,
        stage: s.stage,
        growth: s.monthlyGrowth || "0",
        score: parseFloat(s.score || "0"),
      }))} />

      <SdgSection />

      {/* CTA */}
      <section className="px-6 py-24 md:py-32 border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">Ready to connect?</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-10 max-w-md mx-auto">
            Free for startups. Free for investors. We only make money when you close a deal.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors">
            Get started <ArrowRight size={14} />
          </Link>
          <p className="mt-4 text-xs text-[var(--text-muted)]">3% success fee on close · Verified impact startups: 0%</p>
        </div>
      </section>
    </div>
  );
}
