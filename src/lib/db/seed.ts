import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";

type HireOutcomeStatusType = "interested" | "hired" | "started";

type VerificationStatusType = "unverified" | "pending" | "verified" | "rejected";

const SEED_USERS = {
  workers: [
    {
      email: "worker1@example.com",
      name: "Somchai Pattaya",
      displayName: "Somchai P.",
      location: "Pattaya",
      area: "Central Pattaya",
      description: "Experienced bartender with 5 years in hospitality",
      bio: "Passionate about mixology and customer service. Fluent in English and Thai.",
      availability: "Full-time",
      expectedPayMin: 15000,
      expectedPayMax: 25000,
      jobRoles: ["Bartender", "Server"],
      experienceYears: 5,
      languages: ["English", "Thai"],
      lineId: "somchai_pattaya",
      whatsappNumber: "+66812345678",
      phoneNumber: "+66812345678",
      isTopTalent: true,
      verificationStatus: "verified" as VerificationStatusType,
    },
    {
      email: "worker2@example.com",
      name: "Nattaya Bangkok",
      displayName: "Nattaya B.",
      location: "Bangkok",
      area: "Sukhumvit",
      description: "Professional hostess with luxury hotel experience",
      bio: "Previously worked at 5-star hotels. Multilingual with excellent presentation skills.",
      availability: "Full-time",
      expectedPayMin: 20000,
      expectedPayMax: 35000,
      jobRoles: ["Hostess", "Receptionist"],
      experienceYears: 3,
      languages: ["English", "Thai", "Japanese"],
      lineId: "nattaya_bkk",
      whatsappNumber: "+66823456789",
      phoneNumber: null,
      isTopTalent: true,
      verificationStatus: "verified" as VerificationStatusType,
    },
    {
      email: "worker3@example.com",
      name: "Preecha Chalong",
      displayName: "Preecha C.",
      location: "Pattaya",
      area: "Jomtien",
      description: "DJ and event host with 8 years experience",
      bio: "International DJ with residencies across Asia. Available for events and permanent positions.",
      availability: "Part-time",
      expectedPayMin: 30000,
      expectedPayMax: 50000,
      jobRoles: ["DJ", "Event Host"],
      experienceYears: 8,
      languages: ["English", "Thai"],
      lineId: null,
      whatsappNumber: "+66834567890",
      phoneNumber: "+66834567890",
      isTopTalent: true,
      verificationStatus: "verified" as VerificationStatusType,
    },
    {
      email: "worker4@example.com",
      name: "Araya Silom",
      displayName: "Araya S.",
      location: "Bangkok",
      area: "Silom",
      description: "Promoter and brand ambassador",
      bio: "Experienced in F&B promotions and brand activations. Strong social media presence.",
      availability: "Full-time",
      expectedPayMin: 18000,
      expectedPayMax: 28000,
      jobRoles: ["Promoter", "Brand Ambassador"],
      experienceYears: 4,
      languages: ["English", "Thai", "Korean"],
      lineId: "araya_silom",
      whatsappNumber: null,
      phoneNumber: "+66845678901",
      isTopTalent: false,
      verificationStatus: "pending" as VerificationStatusType,
    },
    {
      email: "worker5@example.com",
      name: "Tanawat Walking",
      displayName: "Tanawat W.",
      location: "Pattaya",
      area: "Walking Street",
      description: "Security and floor manager",
      bio: "10 years in nightlife security. Trained in conflict resolution and first aid.",
      availability: "Full-time",
      expectedPayMin: 22000,
      expectedPayMax: 32000,
      jobRoles: ["Security", "Floor Manager"],
      experienceYears: 10,
      languages: ["English", "Thai", "Russian"],
      lineId: "tanawat_security",
      whatsappNumber: "+66856789012",
      phoneNumber: "+66856789012",
      isTopTalent: false,
      verificationStatus: "pending" as VerificationStatusType,
    },
    {
      email: "worker6@example.com",
      name: "Mayuree Thonglor",
      displayName: "Mayuree T.",
      location: "Bangkok",
      area: "Thonglor",
      description: "Waitress and sommelier in training",
      bio: "2 years in fine dining. Currently pursuing WSET certification.",
      availability: "Full-time",
      expectedPayMin: 16000,
      expectedPayMax: 24000,
      jobRoles: ["Server", "Sommelier"],
      experienceYears: 2,
      languages: ["English", "Thai"],
      lineId: null,
      whatsappNumber: null,
      phoneNumber: "+66867890123",
      isTopTalent: false,
      verificationStatus: "unverified" as VerificationStatusType,
    },
    {
      email: "worker7@example.com",
      name: "Kittipong Beach",
      displayName: "Kittipong B.",
      location: "Pattaya",
      area: "Beach Road",
      description: "Pool attendant and lifeguard",
      bio: "Certified lifeguard with CPR training. Great with tourists.",
      availability: "Part-time",
      expectedPayMin: 12000,
      expectedPayMax: 18000,
      jobRoles: ["Pool Attendant", "Lifeguard"],
      experienceYears: 3,
      languages: ["English", "Thai", "German"],
      lineId: "kitti_beach",
      whatsappNumber: "+66878901234",
      phoneNumber: null,
      isTopTalent: false,
      verificationStatus: "unverified" as VerificationStatusType,
    },
    {
      email: "worker8@example.com",
      name: "Pornpan Asoke",
      displayName: "Pornpan A.",
      location: "Bangkok",
      area: "Asoke",
      description: "Karaoke host and entertainer",
      bio: "Professional singer with karaoke hosting experience. Energetic and engaging.",
      availability: "Part-time",
      expectedPayMin: 15000,
      expectedPayMax: 25000,
      jobRoles: ["Host", "Entertainer"],
      experienceYears: 6,
      languages: ["English", "Thai", "Chinese"],
      lineId: "pornpan_sing",
      whatsappNumber: "+66889012345",
      phoneNumber: "+66889012345",
      isTopTalent: false,
      verificationStatus: "rejected" as VerificationStatusType,
    },
  ],
  recruiters: [
    {
      email: "recruiter-free@example.com",
      name: "Free Recruiter",
      organizationName: "Small Bar Co",
      organizationType: "Bar",
      description: "Local bar looking for part-time staff",
      location: "Pattaya",
      hasSubscription: false,
    },
    {
      email: "recruiter-pro@example.com",
      name: "Pro Recruiter",
      organizationName: "Luxury Venues Group",
      organizationType: "Hotel",
      description: "Premium hospitality group operating multiple venues",
      location: "Bangkok",
      contactEmail: "hr@luxuryvenues.example.com",
      contactPhone: "+66890123456",
      hasSubscription: true,
    },
  ],
};

const TOP_TALENT_VIEW_COUNT = 15;
const NORMAL_VIEW_COUNT = 2;

/**
 * NOTE: Top Talent Ranking v1.1 Change
 *
 * With the v1.1 composite ranking algorithm, Top Talent status is now based on
 * a composite score (0-100) from four factors:
 *   1. Profile completeness (25%)
 *   2. Unique recruiter views (30%)
 *   3. Interest rate (25%)
 *   4. Recency (20%)
 *
 * Previously, Top Talent was determined purely by view count (top 10% of viewed profiles).
 *
 * For local testing, seeded profiles may have different Top Talent designations:
 * - Workers with complete profiles, recent updates, and some interests will rank higher
 * - Workers with stale profiles or incomplete information will rank lower
 * - The "isTopTalent" flag in seed data may not match runtime calculations
 *
 * To test specific ranking scenarios:
 * - Modify profile fields in SEED_USERS.workers to test completeness impact
 * - Add more interests in the "Seeding profile interests" section
 * - Adjust view counts and viewer assignments
 *
 * @see docs/architecture.md for full ranking algorithm documentation
 */

function generateDateOfBirth(): string {
  const now = new Date();
  const minAge = 21;
  const maxAge = 35;
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const birthYear = now.getFullYear() - age;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${birthYear}-${month}-${day}`;
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ ERROR: Cannot run seed in production environment!");
    console.error("   Set NODE_ENV to 'development' or 'test' to run seeds.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🌱 Starting database seed...\n");
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Database: ${connectionString.split("@")[1]?.split("/")[0] || "local"}\n`);

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const createdWorkers: Array<{ userId: string; profileId: string; email: string; isTopTalent: boolean }> = [];
  const createdRecruiters: Array<{ userId: string; email: string; hasSubscription: boolean }> = [];

  try {
    console.log("📦 Seeding workers...");

    for (const worker of SEED_USERS.workers) {
      const existingUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, worker.email))
        .limit(1);

      let userId: string;

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        console.log(`   ♻️  User exists: ${worker.email}`);

        await db
          .update(schema.users)
          .set({
            name: worker.name,
            role: "worker",
            ageVerified: true,
            dateOfBirth: generateDateOfBirth(),
            ageVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId));
      } else {
        const [newUser] = await db
          .insert(schema.users)
          .values({
            email: worker.email,
            name: worker.name,
            role: "worker",
            ageVerified: true,
            dateOfBirth: generateDateOfBirth(),
            ageVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        userId = newUser.id;
        console.log(`   ✅ Created user: ${worker.email}`);
      }

      const existingProfile = await db
        .select()
        .from(schema.workerProfiles)
        .where(eq(schema.workerProfiles.userId, userId))
        .limit(1);

      let profileId: string;

      if (existingProfile.length > 0) {
        profileId = existingProfile[0].id;

        await db
          .update(schema.workerProfiles)
          .set({
            displayName: worker.displayName,
            location: worker.location,
            area: worker.area,
            description: worker.description,
            bio: worker.bio,
            availability: worker.availability,
            expectedPayMin: worker.expectedPayMin,
            expectedPayMax: worker.expectedPayMax,
            payCurrency: "THB",
            jobRoles: worker.jobRoles,
            experienceYears: worker.experienceYears,
            languages: worker.languages,
            lineId: worker.lineId,
            whatsappNumber: worker.whatsappNumber,
            phoneNumber: worker.phoneNumber,
            isPublished: true,
            verificationStatus: worker.verificationStatus,
            isVerified: worker.verificationStatus === "verified",
            updatedAt: new Date(),
          })
          .where(eq(schema.workerProfiles.id, profileId));
      } else {
        const [newProfile] = await db
          .insert(schema.workerProfiles)
          .values({
            userId,
            displayName: worker.displayName,
            location: worker.location,
            area: worker.area,
            description: worker.description,
            bio: worker.bio,
            availability: worker.availability,
            expectedPayMin: worker.expectedPayMin,
            expectedPayMax: worker.expectedPayMax,
            payCurrency: "THB",
            jobRoles: worker.jobRoles,
            experienceYears: worker.experienceYears,
            languages: worker.languages,
            lineId: worker.lineId,
            whatsappNumber: worker.whatsappNumber,
            phoneNumber: worker.phoneNumber,
            isPublished: true,
            verificationStatus: worker.verificationStatus,
            isVerified: worker.verificationStatus === "verified",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        profileId = newProfile.id;
      }

      createdWorkers.push({
        userId,
        profileId,
        email: worker.email,
        isTopTalent: worker.isTopTalent,
      });
    }

    console.log("\n📦 Seeding recruiters...");

    for (const recruiter of SEED_USERS.recruiters) {
      const existingUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, recruiter.email))
        .limit(1);

      let userId: string;

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        console.log(`   ♻️  User exists: ${recruiter.email}`);

        await db
          .update(schema.users)
          .set({
            name: recruiter.name,
            role: "recruiter",
            ageVerified: true,
            dateOfBirth: generateDateOfBirth(),
            ageVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId));
      } else {
        const [newUser] = await db
          .insert(schema.users)
          .values({
            email: recruiter.email,
            name: recruiter.name,
            role: "recruiter",
            ageVerified: true,
            dateOfBirth: generateDateOfBirth(),
            ageVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        userId = newUser.id;
        console.log(`   ✅ Created user: ${recruiter.email}`);
      }

      const existingProfile = await db
        .select()
        .from(schema.recruiterProfiles)
        .where(eq(schema.recruiterProfiles.userId, userId))
        .limit(1);

      if (existingProfile.length > 0) {
        await db
          .update(schema.recruiterProfiles)
          .set({
            organizationName: recruiter.organizationName,
            organizationType: recruiter.organizationType,
            description: recruiter.description,
            location: recruiter.location,
            contactEmail: recruiter.contactEmail ?? null,
            contactPhone: recruiter.contactPhone ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.recruiterProfiles.userId, userId));
      } else {
        await db.insert(schema.recruiterProfiles).values({
          userId,
          organizationName: recruiter.organizationName,
          organizationType: recruiter.organizationType,
          description: recruiter.description,
          location: recruiter.location,
          contactEmail: recruiter.contactEmail ?? null,
          contactPhone: recruiter.contactPhone ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (recruiter.hasSubscription) {
        const existingSub = await db
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, userId))
          .limit(1);

        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        if (existingSub.length > 0) {
          await db
            .update(schema.subscriptions)
            .set({
              status: "active",
              plan: "top_talent_unlock",
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              updatedAt: new Date(),
            })
            .where(eq(schema.subscriptions.userId, userId));
        } else {
          await db.insert(schema.subscriptions).values({
            userId,
            stripeCustomerId: `cus_seed_${userId.slice(0, 8)}`,
            stripeSubscriptionId: `sub_seed_${userId.slice(0, 8)}`,
            stripePriceId: "price_seed_top_talent",
            status: "active",
            plan: "top_talent_unlock",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        console.log(`   💳 Subscription active for: ${recruiter.email}`);
      }

      createdRecruiters.push({
        userId,
        email: recruiter.email,
        hasSubscription: recruiter.hasSubscription,
      });
    }

    console.log("\n📦 Seeding profile views for Top Talent ranking...");

    const viewerRecruiter = createdRecruiters.find((r) => r.hasSubscription);

    for (const worker of createdWorkers) {
      await db
        .delete(schema.profileViews)
        .where(eq(schema.profileViews.workerProfileId, worker.profileId));

      const viewCount = worker.isTopTalent ? TOP_TALENT_VIEW_COUNT : NORMAL_VIEW_COUNT;

      const viewsToInsert = [];
      for (let i = 0; i < viewCount; i++) {
        const viewedAt = new Date();
        viewedAt.setDate(viewedAt.getDate() - Math.floor(Math.random() * 25));

        viewsToInsert.push({
          workerProfileId: worker.profileId,
          viewerUserId: i % 3 === 0 && viewerRecruiter ? viewerRecruiter.userId : null,
          viewerIpHash: `seed_hash_${i}_${worker.profileId.slice(0, 8)}`,
          viewedAt,
        });
      }

      if (viewsToInsert.length > 0) {
        await db.insert(schema.profileViews).values(viewsToInsert);
      }

      const status = worker.isTopTalent ? "⭐ Top Talent" : "   Normal";
      console.log(`   ${status}: ${worker.email} (${viewCount} views)`);
    }

    console.log("\n📦 Seeding profile interests (for hire outcome demos)...");

    const topTalentWorkers = createdWorkers.filter((w) => w.isTopTalent);
    const normalWorkers = createdWorkers.filter((w) => !w.isTopTalent);
    const createdInterests: Array<{ interestId: string; recruiterEmail: string; workerEmail: string }> = [];

    for (const recruiter of createdRecruiters) {
      const workersToInterest = recruiter.hasSubscription
        ? [...topTalentWorkers.slice(0, 2), ...normalWorkers.slice(0, 1)]
        : normalWorkers.slice(0, 2);

      for (const worker of workersToInterest) {
        const existing = await db
          .select()
          .from(schema.profileInterests)
          .where(
            and(
              eq(schema.profileInterests.recruiterUserId, recruiter.userId),
              eq(schema.profileInterests.workerProfileId, worker.profileId)
            )
          )
          .limit(1);

        let interestId: string;
        if (existing.length === 0) {
          const [newInterest] = await db.insert(schema.profileInterests).values({
            recruiterUserId: recruiter.userId,
            workerProfileId: worker.profileId,
            message: recruiter.hasSubscription
              ? "We have an exciting opportunity for you at our venue!"
              : "Interested in discussing a position with you.",
            createdAt: new Date(),
          }).returning();

          interestId = newInterest.id;
          console.log(`   ✅ ${recruiter.email} → ${worker.email}`);
        } else {
          interestId = existing[0].id;
        }

        createdInterests.push({
          interestId,
          recruiterEmail: recruiter.email,
          workerEmail: worker.email,
        });
      }
    }

    console.log("\n📦 Seeding hire outcomes...");

    const hireOutcomesSeed: Array<{
      recruiterEmail: string;
      workerEmail: string;
      status: HireOutcomeStatusType;
      notes: string;
    }> = [
      {
        recruiterEmail: "recruiter-pro@example.com",
        workerEmail: "worker1@example.com",
        status: "started",
        notes: "Started as bartender at Sukhumvit location on Monday shifts",
      },
      {
        recruiterEmail: "recruiter-pro@example.com",
        workerEmail: "worker2@example.com",
        status: "hired",
        notes: "Hired for hostess position, starting next month",
      },
      {
        recruiterEmail: "recruiter-free@example.com",
        workerEmail: "worker4@example.com",
        status: "interested",
        notes: null as unknown as string,
      },
    ];

    for (const outcomeSeed of hireOutcomesSeed) {
      const interest = createdInterests.find(
        (i) =>
          i.recruiterEmail === outcomeSeed.recruiterEmail &&
          i.workerEmail === outcomeSeed.workerEmail
      );

      if (!interest) {
        console.log(`   ⚠️  Interest not found for ${outcomeSeed.recruiterEmail} → ${outcomeSeed.workerEmail}`);
        continue;
      }

      const existingOutcome = await db
        .select()
        .from(schema.hireOutcomes)
        .where(eq(schema.hireOutcomes.interestId, interest.interestId))
        .limit(1);

      const now = new Date();
      const hiredAt = outcomeSeed.status === "hired" || outcomeSeed.status === "started" ? now : null;
      const startedAt = outcomeSeed.status === "started" ? now : null;

      if (existingOutcome.length === 0) {
        await db.insert(schema.hireOutcomes).values({
          interestId: interest.interestId,
          status: outcomeSeed.status,
          hiredAt,
          startedAt,
          notes: outcomeSeed.notes,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`   ✅ ${outcomeSeed.status.toUpperCase()}: ${outcomeSeed.recruiterEmail} → ${outcomeSeed.workerEmail}`);
      } else {
        await db
          .update(schema.hireOutcomes)
          .set({
            status: outcomeSeed.status,
            hiredAt,
            startedAt,
            notes: outcomeSeed.notes,
            updatedAt: now,
          })
          .where(eq(schema.hireOutcomes.id, existingOutcome[0].id));
        console.log(`   ♻️  ${outcomeSeed.status.toUpperCase()}: ${outcomeSeed.recruiterEmail} → ${outcomeSeed.workerEmail}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📋 SEEDED ACCOUNTS:\n");

    console.log("👷 WORKERS:");
    console.log("-".repeat(40));
    for (const worker of SEED_USERS.workers) {
      const talentStatus = worker.isTopTalent ? "⭐ Top Talent" : "   Normal";
      const verifyIcon = {
        verified: "✅",
        pending: "⏳",
        unverified: "❓",
        rejected: "❌",
      }[worker.verificationStatus];
      console.log(`${talentStatus} | ${verifyIcon} ${worker.verificationStatus}`);
      console.log(`   Email: ${worker.email}`);
      console.log(`   Name:  ${worker.name}`);
      console.log(`   Area:  ${worker.area}, ${worker.location}`);
      console.log("");
    }

    console.log("🏢 RECRUITERS:");
    console.log("-".repeat(40));
    for (const recruiter of SEED_USERS.recruiters) {
      const status = recruiter.hasSubscription ? "💳 Subscribed" : "🆓 Free";
      console.log(`${status}`);
      console.log(`   Email: ${recruiter.email}`);
      console.log(`   Name:  ${recruiter.name}`);
      console.log(`   Org:   ${recruiter.organizationName}`);
      console.log("");
    }

    console.log("=".repeat(60));
    console.log("🔐 HOW TO SIGN IN (Development Only):");
    console.log("=".repeat(60));
    console.log("\n1. Set environment variables:");
    console.log("   NODE_ENV=development");
    console.log("   AUTH_DEV_BYPASS=true");
    console.log("\n2. Start the dev server: npm run dev");
    console.log("3. Go to: http://localhost:3000/auth/signin");
    console.log("4. Click 'Continue with Email'");
    console.log("5. Enter one of the seed emails above");
    console.log("6. You'll be signed in (dev bypass enabled)\n");
    console.log("⚠️  SECURITY: Email-only sign-in requires BOTH:");
    console.log("   - NODE_ENV=development");
    console.log("   - AUTH_DEV_BYPASS=true");
    console.log("\n   This is BLOCKED in production to prevent account hijacking.\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
