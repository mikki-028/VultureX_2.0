import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users, startups, investors, competitions, decks } from "./schema";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { resolveDatabaseUrl } from "./config";

const connectionString = resolveDatabaseUrl();
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding database...");

  // Create demo users
  const passwordHash = await hash("demo123", 12);

  const [startupUser1] = await db
    .insert(users)
    .values({
      email: "founder@greenpath.io",
      name: "Amina Adeyemi",
      passwordHash,
      role: "startup",
    })
    .returning();

  const [startupUser2] = await db
    .insert(users)
    .values({
      email: "james@solarflow.com",
      name: "James Chen",
      passwordHash,
      role: "startup",
    })
    .returning();

  const [startupUser3] = await db
    .insert(users)
    .values({
      email: "priya@techflow.ai",
      name: "Priya Sharma",
      passwordHash,
      role: "startup",
    })
    .returning();

  const [startupUser4] = await db
    .insert(users)
    .values({
      email: "alex@paybridge.io",
      name: "Alex Rivera",
      passwordHash,
      role: "startup",
    })
    .returning();

  const [startupUser5] = await db
    .insert(users)
    .values({
      email: "sarah@edunext.co",
      name: "Sarah Kim",
      passwordHash,
      role: "startup",
    })
    .returning();

  const [investorUser1] = await db
    .insert(users)
    .values({
      email: "investor@horizon.vc",
      name: "Michael Torres",
      passwordHash,
      role: "investor",
    })
    .returning();

  const [investorUser2] = await db
    .insert(users)
    .values({
      email: "angel@firstcheck.co",
      name: "Diana Osei",
      passwordHash,
      role: "investor",
    })
    .returning();

  console.log("✓ Users created");

  // Create startup profiles
  const startupsData = [
    {
      userId: startupUser1.id,
      slug: "greenpath",
      name: "GreenPath",
      tagline: "AI-powered carbon tracking for supply chains",
      sector: "climate",
      stage: "seed",
      location: "Lagos, Nigeria",
      website: "https://greenpath.io",
      tags: ["climate", "ai", "b2b", "saas"],
      problem: "Supply chains account for 60% of corporate emissions but lack real-time visibility. Companies spend $50K+ on manual audits that are outdated by the time they're completed.",
      solution: "GreenPath uses IoT sensors and ML models to provide real-time carbon tracking across the entire supply chain. Automated reporting saves 90% of audit costs.",
      mrr: 4700000, // $47K
      monthlyGrowth: "34",
      activeUsers: 2800,
      customers: 45,
      fundingRaised: 200000000, // $2M
      burnRate: 8500000, // $85K
      runwayMonths: 18,
      founderName: "Amina Adeyemi",
      founderRole: "CEO & Co-Founder",
      founderBio: "Former McKinsey sustainability practice. Built carbon tracking systems for 3 Fortune 500 companies. MIT MBA.",
      founderLinkedin: "https://linkedin.com/in/aminaadeyemi",
      teamSize: 12,
      score: "82",
      scoreBreakdown: { total: 82, traction: 30, financial: 20, team: 13, market: 13, momentum: 6 },
    },
    {
      userId: startupUser2.id,
      slug: "solarflow",
      name: "SolarFlow",
      tagline: "Peer-to-peer solar energy marketplace",
      sector: "climate",
      stage: "series-a",
      location: "Austin, TX",
      website: "https://solarflow.com",
      tags: ["climate", "marketplace", "energy", "p2p"],
      problem: "50 million US homeowners with solar panels can't easily sell excess energy to their neighbors. $12B in solar energy is wasted annually.",
      solution: "SolarFlow is a marketplace that lets solar panel owners sell excess energy directly to neighbors at 30% below utility rates, using smart meter integrations.",
      mrr: 12000000, // $120K
      monthlyGrowth: "22",
      activeUsers: 15000,
      customers: 3200,
      fundingRaised: 800000000, // $8M
      burnRate: 25000000, // $250K
      runwayMonths: 14,
      founderName: "James Chen",
      founderRole: "CEO",
      founderBio: "Ex-Tesla energy division. 2x founder (first company acquired by Enphase). Stanford EE.",
      founderLinkedin: "https://linkedin.com/in/jameschen",
      teamSize: 28,
      score: "76",
      scoreBreakdown: { total: 76, traction: 28, financial: 18, team: 14, market: 12, momentum: 4 },
    },
    {
      userId: startupUser3.id,
      slug: "techflow-ai",
      name: "TechFlow AI",
      tagline: "No-code AI agents for customer support",
      sector: "ai/ml",
      stage: "seed",
      location: "San Francisco, CA",
      website: "https://techflow.ai",
      tags: ["ai", "no-code", "saas", "customer-support"],
      problem: "Companies spend $1.3T/year on customer support. 70% of tickets are repetitive questions that could be automated, but building AI requires ML engineers.",
      solution: "TechFlow lets any support team build custom AI agents in minutes — no code, no ML engineers. Resolves 60% of tickets automatically on day one.",
      mrr: 3200000, // $32K
      monthlyGrowth: "28",
      activeUsers: 890,
      customers: 67,
      fundingRaised: 150000000, // $1.5M
      burnRate: 6000000, // $60K
      runwayMonths: 20,
      founderName: "Priya Sharma",
      founderRole: "CEO & CTO",
      founderBio: "Former Google AI Research. Led the team that built Google's internal support bot serving 100K employees. IIT Delhi + Stanford CS PhD.",
      founderLinkedin: "https://linkedin.com/in/priyasharma",
      teamSize: 8,
      score: "71",
      scoreBreakdown: { total: 71, traction: 25, financial: 17, team: 12, market: 13, momentum: 4 },
    },
    {
      userId: startupUser4.id,
      slug: "paybridge",
      name: "PayBridge",
      tagline: "Cross-border payments for African SMBs",
      sector: "fintech",
      stage: "pre-seed",
      location: "Nairobi, Kenya",
      website: "https://paybridge.io",
      tags: ["fintech", "africa", "payments", "stablecoin"],
      problem: "African SMBs pay 8-12% in fees for cross-border payments. $180B in intra-African trade is held back by payment friction.",
      solution: "PayBridge uses stablecoin rails to offer 1% flat-fee cross-border payments settled in under 60 seconds across 15 African countries.",
      mrr: 800000, // $8K
      monthlyGrowth: "45",
      activeUsers: 420,
      customers: 120,
      fundingRaised: 30000000, // $300K
      burnRate: 2500000, // $25K
      runwayMonths: 10,
      founderName: "Alex Rivera",
      founderRole: "CEO & Co-Founder",
      founderBio: "Former Stripe engineer (Payments team). Previously built mobile money solutions at M-Pesa. University of Nairobi CS.",
      founderLinkedin: "https://linkedin.com/in/alexrivera",
      teamSize: 5,
      score: "64",
      scoreBreakdown: { total: 64, traction: 21, financial: 12, team: 10, market: 15, momentum: 6 },
    },
    {
      userId: startupUser5.id,
      slug: "edunext",
      name: "EduNext",
      tagline: "AI tutoring that adapts to how you learn",
      sector: "edtech",
      stage: "pre-seed",
      location: "Toronto, Canada",
      website: "https://edunext.co",
      tags: ["edtech", "ai", "consumer", "subscription"],
      problem: "1-on-1 tutoring costs $50-150/hour. 80% of students who need it can't afford it. Generic online courses have 5% completion rates.",
      solution: "EduNext uses LLMs fine-tuned on pedagogy research to create adaptive tutors that match each student's learning style. $9.99/month unlimited.",
      mrr: 500000, // $5K
      monthlyGrowth: "18",
      activeUsers: 3200,
      customers: 890,
      fundingRaised: 10000000, // $100K
      burnRate: 1500000, // $15K
      runwayMonths: 6,
      founderName: "Sarah Kim",
      founderRole: "CEO",
      founderBio: "Former teacher turned engineer. Built Khan Academy's recommendation engine. Education PhD from OISE, University of Toronto.",
      founderLinkedin: "https://linkedin.com/in/sarahkim",
      teamSize: 3,
      score: "52",
      scoreBreakdown: { total: 52, traction: 16, financial: 8, team: 8, market: 12, momentum: 8 },
    },
  ];

  const createdStartups = await db.insert(startups).values(startupsData).returning();
  console.log("✓ Startups created:", createdStartups.length);

  // Create investor profiles
  await db.insert(investors).values([
    {
      userId: investorUser1.id,
      fullName: "Michael Torres",
      investorType: "vc",
      firmName: "Horizon Ventures",
      location: "New York, NY",
      checkSizeMin: 500,
      checkSizeMax: 5000,
      stageFocus: ["seed", "series-a"],
      sectorFocus: ["climate", "fintech", "saas"],
      investmentThesis: "We back technical founders solving infrastructure problems with 10x better economics. Especially excited about climate and fintech in emerging markets.",
      linkedin: "https://linkedin.com/in/michaeltorres",
    },
    {
      userId: investorUser2.id,
      fullName: "Diana Osei",
      investorType: "angel",
      firmName: null,
      location: "London, UK",
      checkSizeMin: 25,
      checkSizeMax: 200,
      stageFocus: ["pre-seed", "seed"],
      sectorFocus: ["ai/ml", "edtech", "healthtech"],
      investmentThesis: "I invest in AI-native companies that make expensive human services accessible to everyone. Strong bias toward repeat founders and PhD-level technical teams.",
      linkedin: "https://linkedin.com/in/dianaosei",
    },
  ]);
  console.log("✓ Investors created");

  // Create competitions
  const [comp1] = await db
    .insert(competitions)
    .values([
      {
        title: "Climate Tech Challenge — Q3 2026",
        description: "Show us the startups that will decarbonize industry. Top 3 get direct intros to our climate VC network.",
        sector: "climate",
        prize: "$50K + 5 VC intros",
        deadline: new Date("2026-08-15T23:59:59Z"),
        status: "active",
      },
      {
        title: "AI Disruptors 2026",
        description: "The most promising AI startups competing for visibility and funding. Open to all AI/ML companies.",
        sector: "ai/ml",
        prize: "$25K + accelerator spot",
        deadline: new Date("2026-07-30T23:59:59Z"),
        status: "active",
      },
      {
        title: "Fintech Africa",
        description: "Celebrating fintech innovation across the African continent.",
        sector: "fintech",
        prize: "$30K + Lagos Demo Day",
        deadline: new Date("2026-09-01T23:59:59Z"),
        status: "active",
      },
    ])
    .returning();
  console.log("✓ Competitions created");

  // Create sample decks
  const sampleSlides = [
    { type: "title", headline: "GreenPath", body: "AI-powered carbon tracking for supply chains. Making sustainability measurable, actionable, and profitable.", metric: { value: "$47K", label: "Monthly Revenue" } },
    { type: "problem", headline: "Supply chains are flying blind", body: "60% of corporate emissions come from supply chains. Companies spend $50K+ on manual audits that are outdated before they're finished. $2.3T in climate commitments with no way to verify progress.", bullets: ["Manual audits cost $50K+ and take 6 months", "Data is stale by the time reports are filed", "Scope 3 emissions are nearly impossible to track"] },
    { type: "solution", headline: "Real-time visibility, automated", body: "IoT sensors + ML models provide continuous carbon tracking across the entire supply chain. Automated reporting cuts audit costs by 90%.", bullets: ["Plug-and-play IoT sensors at every supply chain node", "ML models predict emissions in real-time", "One-click compliance reporting (CDP, SBTi, TCFD)"] },
    { type: "market", headline: "$44B market growing 25% YoY", body: "The carbon management software market is exploding as regulations tighten globally. EU CSRD alone will force 50,000 companies to report.", metric: { value: "$44B", label: "TAM by 2028" } },
    { type: "traction", headline: "Growing 34% month over month", body: "45 enterprise customers, $47K MRR, 2,800 active sensors deployed. Just signed our first Fortune 500 contract.", metric: { value: "+34%", label: "Monthly Growth" } },
    { type: "business_model", headline: "SaaS + hardware margin", body: "Per-sensor subscription ($99/mo) + platform fee based on supply chain complexity. 78% gross margin on software, 45% on hardware.", bullets: ["$99/sensor/month (avg 62 sensors per customer)", "Platform fee: $2K-15K/month based on complexity", "Hardware sold at 45% margin", "Net revenue retention: 135%"] },
    { type: "team", headline: "Built by climate + AI experts", body: "12-person team combining deep climate expertise with ML engineering. Founder previously built carbon systems for Fortune 500 at McKinsey.", bullets: ["Amina Adeyemi (CEO) — Ex-McKinsey sustainability, MIT MBA", "CTO — Ex-Google DeepMind, sensor fusion expert", "VP Sales — 15 years enterprise sustainability software"] },
    { type: "ask", headline: "Raising $5M Series A", body: "To expand sensor network to 3 new geographies, hire 8 engineers, and close our Fortune 500 pipeline.", bullets: ["$2M — Engineering (ML team expansion)", "$1.5M — Hardware manufacturing scale", "$1M — Sales & marketing", "$500K — Operations"], metric: { value: "$5M", label: "Series A" } },
  ];

  await db.insert(decks).values({
    startupId: createdStartups[0].id,
    title: "GreenPath Pitch Deck",
    slides: sampleSlides,
    template: "minimal",
    shareToken: crypto.randomBytes(12).toString("hex"),
  });
  console.log("✓ Sample deck created");

  console.log("\n✅ Seed complete! Demo credentials:");
  console.log("   Startup: founder@greenpath.io / demo123");
  console.log("   Investor: investor@horizon.vc / demo123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
