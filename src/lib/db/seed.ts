import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";
import {
  parseDatabaseUrl,
  requireLocalDatabaseUrl,
  describeDatabaseTarget,
} from "./safety";
import {
  generateAllSeedAssets,
  SEED_CHALLENGE_CODE,
} from "../../../scripts/seed-assets/generate";
import {
  assertSeedObjectsExist,
  isSeedPrivateStorageConfigured,
  isSeedPublicStorageConfigured,
  printSeedMediaSummary,
  publicUrlOrPlaceholder,
  readSeedFile,
  resetSeedMediaStats,
  uploadPrivateIdSeedObject,
  uploadPrivateLivenessSeedObject,
  uploadPublicSeedObject,
} from "./seed-media";
import { parseVenueLink } from "@/lib/venues/link";
import { upsertAdminEntitlement } from "@/lib/entitlements/grants";
import { getRecruiterAccess } from "@/lib/recruiter-access";
import { isProfileTopTalent } from "@/lib/ranking";
import { isSearchableWorker } from "@/lib/verification";

/**
 * Seeded worker LINE / WhatsApp / phone values are private profile fields only.
 * They must never appear in recruiter-facing APIs or UI.
 */

function allowProductionSeed(): boolean {
  return (
    process.argv.includes("--force-production") ||
    process.env.SEED_ALLOW_PRODUCTION === "1"
  );
}

function refuseProductionLikeSeed(databaseUrl: string | undefined): void {
  if (allowProductionSeed()) {
    return;
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  const neonHost =
    parsed.ok && parsed.parsed.host.toLowerCase().includes("neon.tech");
  const productionEnv = process.env.NODE_ENV === "production";

  if (neonHost || productionEnv) {
    console.error(
      "❌ ERROR: Refusing to seed a production-like database."
    );
    console.error(
      "   DATABASE_URL looks like Neon production or NODE_ENV=production."
    );
    console.error(
      "   Pass --force-production or set SEED_ALLOW_PRODUCTION=1 to override."
    );
    process.exit(1);
  }
}

type HireOutcomeStatusType = "interested" | "hired" | "started";

type VerificationStatusType = "unverified" | "pending" | "verified" | "rejected";

interface SeedOpening {
  role: string;
  area: string;
  payMin?: number;
  payMax?: number;
  notes?: string;
  isPublished?: boolean;
  /** Index into seed venues for this recruiter (default 0 / primary). */
  venueIndex?: number;
}

type VenueReviewStatusType = "pending" | "approved" | "rejected";

interface SeedVenue {
  name: string;
  venueType?: string;
  area?: string;
  subArea?: string;
  blurb?: string;
  venueLinkUrl: string;
  venueLinkKind: "google_maps" | "facebook" | "instagram";
  reviewStatus: VenueReviewStatusType;
  reviewNote?: string;
  isPrimary?: boolean;
}

interface SeedRecruiter {
  email: string;
  name: string;
  organizationName: string;
  organizationType: string;
  description: string;
  location: string;
  area?: string;
  subArea?: string;
  blurb?: string;
  contactEmail?: string;
  contactPhone?: string;
  lineId?: string;
  website?: string;
  hasSubscription: boolean;
  verificationStatus?: VerificationStatusType;
  venues?: SeedVenue[];
  openings?: SeedOpening[];
}

const SEED_USERS: {
  workers: Array<{
    email: string;
    name: string;
    displayName: string;
    location: string;
    area: string;
    description: string;
    bio: string;
    availability: string[];
    expectedPayMin: number;
    expectedPayPeriod: "day" | "month";
    jobRoles: string[];
    experienceYears: number;
    languages: string[];
    lineId: string | null;
    whatsappNumber: string | null;
    phoneNumber: string | null;
    isTopTalent: boolean;
    verificationStatus: VerificationStatusType;
  }>;
  recruiters: SeedRecruiter[];
} = {
  workers: [
    {
      email: "worker1@example.com",
      name: "Somchai Pattaya",
      displayName: "Somchai P.",
      location: "Pattaya",
      area: "Central Pattaya",
      description: "Experienced bartender with 5 years in hospitality",
      bio: "Passionate about mixology and customer service. Fluent in English and Thai.",
      availability: ["Full-time"],
      expectedPayMin: 15000,
      expectedPayPeriod: "month",
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
      availability: ["Full-time"],
      expectedPayMin: 20000,
      expectedPayPeriod: "month",
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
      availability: ["Part-time"],
      expectedPayMin: 30000,
      expectedPayPeriod: "month",
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
      availability: ["Full-time"],
      expectedPayMin: 18000,
      expectedPayPeriod: "month",
      jobRoles: ["Promoter", "Brand Ambassador"],
      experienceYears: 4,
      languages: ["English", "Thai", "Korean"],
      lineId: "araya_silom",
      whatsappNumber: null,
      phoneNumber: "+66845678901",
      isTopTalent: false,
      verificationStatus: "verified" as VerificationStatusType,
    },
    {
      email: "worker5@example.com",
      name: "Tanawat Walking",
      displayName: "Tanawat W.",
      location: "Pattaya",
      area: "Walking Street",
      description: "Security and floor manager",
      bio: "10 years in nightlife security. Trained in conflict resolution and first aid.",
      availability: ["Full-time"],
      expectedPayMin: 22000,
      expectedPayPeriod: "month",
      jobRoles: ["Security", "Floor Manager"],
      experienceYears: 10,
      languages: ["English", "Thai", "Russian"],
      lineId: "tanawat_security",
      whatsappNumber: "+66856789012",
      phoneNumber: "+66856789012",
      isTopTalent: false,
      verificationStatus: "verified" as VerificationStatusType,
    },
    {
      email: "worker6@example.com",
      name: "Mayuree Thonglor",
      displayName: "Mayuree T.",
      location: "Bangkok",
      area: "Thonglor",
      description: "Waitress and sommelier in training",
      bio: "2 years in fine dining. Currently pursuing WSET certification.",
      availability: ["Full-time"],
      expectedPayMin: 16000,
      expectedPayPeriod: "month",
      jobRoles: ["Server", "Sommelier"],
      experienceYears: 2,
      languages: ["English", "Thai"],
      lineId: null,
      whatsappNumber: null,
      phoneNumber: "+66867890123",
      isTopTalent: false,
      verificationStatus: "pending" as VerificationStatusType,
    },
    {
      email: "worker7@example.com",
      name: "Kittipong Beach",
      displayName: "Kittipong B.",
      location: "Pattaya",
      area: "Beach Road",
      description: "Pool attendant and lifeguard",
      bio: "Certified lifeguard with CPR training. Great with tourists.",
      availability: ["Part-time"],
      expectedPayMin: 12000,
      expectedPayPeriod: "month",
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
      availability: ["Part-time"],
      expectedPayMin: 15000,
      expectedPayPeriod: "month",
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
      email: "recruiter-unverified@example.com",
      name: "Unverified Recruiter",
      organizationName: "Teaser Browse Co",
      organizationType: "Bar",
      description: "Unverified recruiter for teaser browse testing",
      location: "Pattaya",
      area: "Central Pattaya",
      blurb: "Seed recruiter used to test blurred teaser search before identity verification.",
      website: "https://www.facebook.com/teaserbrowseco",
      hasSubscription: false,
      verificationStatus: "unverified",
      venues: [
        {
          name: "Teaser Browse Co",
          venueType: "Bar",
          area: "Central Pattaya",
          blurb: "Venue pending — recruiter is still unverified.",
          venueLinkUrl: "https://www.facebook.com/paidtalent.seed.teaserbrowse",
          venueLinkKind: "facebook",
          reviewStatus: "pending",
          isPrimary: true,
        },
      ],
      openings: [],
    },
    {
      email: "recruiter-free@example.com",
      name: "Free Recruiter",
      organizationName: "Small Bar Co",
      organizationType: "Bar",
      description: "Local bar looking for part-time staff",
      location: "Pattaya",
      area: "Walking Street",
      subArea: "Soi 6",
      blurb: "Friendly neighborhood bar with live music and great cocktails. Looking for enthusiastic staff!",
      website: "https://www.facebook.com/paidtalent.seed.smallbarco",
      contactPhone: "+66811110001",
      lineId: "seed_free_owner",
      hasSubscription: false,
      verificationStatus: "verified",
      venues: [
        {
          name: "Small Bar Co",
          venueType: "Bar",
          area: "Walking Street",
          subArea: "Soi 6",
          blurb: "Friendly neighborhood bar with live music and great cocktails.",
          venueLinkUrl: "https://www.facebook.com/paidtalent.seed.smallbarco",
          venueLinkKind: "facebook",
          reviewStatus: "approved",
          isPrimary: true,
        },
      ],
      openings: [
        {
          role: "Bartender",
          area: "Walking Street",
          payMin: 500,
          payMax: 800,
          notes: "Weekend shifts preferred. Must have basic cocktail knowledge.",
          isPublished: true,
          venueIndex: 0,
        },
      ],
    },
    {
      email: "recruiter-pro@example.com",
      name: "Pro Recruiter",
      organizationName: "Luxury Venues Group",
      organizationType: "Hotel",
      description: "Premium hospitality group operating multiple venues",
      location: "Bangkok",
      area: "Sukhumvit",
      subArea: "Soi 11",
      blurb: "Award-winning hospitality group with rooftop bars, fine dining, and nightclubs across Bangkok.",
      contactEmail: "hr@luxuryvenues.example.com",
      contactPhone: "+66890123456",
      lineId: "seed_pro_hr",
      website: "https://maps.app.goo.gl/PaidTalentSeed01",
      hasSubscription: true,
      verificationStatus: "verified",
      venues: [
        {
          name: "Skyline Rooftop",
          venueType: "Hotel",
          area: "Sukhumvit",
          subArea: "Soi 11",
          blurb: "Flagship rooftop bar with city views.",
          venueLinkUrl:
            "https://www.google.com/maps/place/Seed+Rooftop+Bar,+Sukhumvit+Soi+11,+Bangkok",
          venueLinkKind: "google_maps",
          reviewStatus: "approved",
          isPrimary: true,
        },
        {
          name: "Thonglor Speakeasy",
          venueType: "Bar",
          area: "Thonglor",
          blurb: "Craft cocktail bar for late nights.",
          venueLinkUrl: "https://www.instagram.com/paidtalent.seed.speakeasy",
          venueLinkKind: "instagram",
          reviewStatus: "pending",
          isPrimary: false,
        },
        {
          name: "RCA Neon Club",
          venueType: "Club",
          area: "RCA",
          blurb: "High-energy nightclub — link needs a better Maps URL.",
          venueLinkUrl: "https://www.facebook.com/paidtalent.seed.neonclub",
          venueLinkKind: "facebook",
          reviewStatus: "rejected",
          reviewNote: "Link doesn't show the venue name",
          isPrimary: false,
        },
      ],
      openings: [
        {
          role: "Hostess",
          area: "Sukhumvit",
          payMin: 800,
          payMax: 1500,
          notes: "For our flagship rooftop venue. English fluency required. Experience in upscale venues preferred.",
          isPublished: true,
          venueIndex: 0,
        },
        {
          role: "Bartender",
          area: "Sukhumvit",
          payMin: 700,
          payMax: 1200,
          notes: "Mixology skills required. Craft cocktail experience a plus.",
          isPublished: true,
          venueIndex: 0,
        },
        {
          role: "Server",
          area: "Sukhumvit",
          payMin: 600,
          payMax: 1000,
          notes: "Fine dining experience preferred. Wine knowledge is a bonus.",
          isPublished: false,
          venueIndex: 0,
        },
      ],
    },
    {
      email: "recruiter-pending@example.com",
      name: "Pending Recruiter",
      organizationName: "Review Queue Club",
      organizationType: "Club",
      description: "Nightclub awaiting identity verification review",
      location: "Bangkok",
      area: "RCA",
      blurb: "Seed recruiter in pending verification state for admin queue testing.",
      website: "https://www.facebook.com/paidtalent.seed.reviewqueue",
      contactPhone: "+66811110002",
      hasSubscription: false,
      verificationStatus: "pending",
      venues: [
        {
          name: "Review Queue Club",
          venueType: "Club",
          area: "RCA",
          blurb: "Seed venue awaiting link review.",
          venueLinkUrl: "https://www.facebook.com/paidtalent.seed.reviewqueue",
          venueLinkKind: "facebook",
          reviewStatus: "pending",
          isPrimary: true,
        },
      ],
      openings: [],
    },
    {
      email: "recruiter-rejected@example.com",
      name: "Rejected Recruiter",
      organizationName: "Resubmit Lounge",
      organizationType: "Bar",
      description: "Venue that needs to resubmit identity verification",
      location: "Chiang Mai",
      area: "Nimman",
      blurb: "Seed recruiter in rejected verification state.",
      website: "https://www.instagram.com/paidtalent.seed.resubmit",
      hasSubscription: false,
      verificationStatus: "rejected",
      venues: [
        {
          name: "Resubmit Lounge",
          venueType: "Bar",
          area: "Nimman",
          blurb: "Seed venue with rejected link for queue testing.",
          venueLinkUrl: "https://www.instagram.com/paidtalent.seed.resubmit",
          venueLinkKind: "instagram",
          reviewStatus: "rejected",
          reviewNote: "Link doesn't show the venue name",
          isPrimary: true,
        },
      ],
      openings: [],
    },
    {
      email: "recruiter-pass@example.com",
      name: "Pass Recruiter",
      organizationName: "Pass Access Bar",
      organizationType: "Bar",
      description: "Verified recruiter with an active Top Talent pass",
      location: "Bangkok",
      area: "Asoke",
      blurb: "Exercises Verified Pro access via a 7-day pass.",
      website: "https://www.facebook.com/paidtalent.seed.passvenue",
      contactPhone: "+66811110003",
      lineId: "seed_pass_hr",
      hasSubscription: false,
      verificationStatus: "verified",
      venues: [
        {
          name: "Pass Access Bar",
          venueType: "Bar",
          area: "Asoke",
          blurb: "Approved venue for pass-access recruiter.",
          venueLinkUrl: "https://www.facebook.com/paidtalent.seed.passvenue",
          venueLinkKind: "facebook",
          reviewStatus: "approved",
          isPrimary: true,
        },
      ],
      openings: [
        {
          role: "Server",
          area: "Asoke",
          payMin: 600,
          payMax: 900,
          isPublished: true,
          venueIndex: 0,
        },
      ],
    },
    {
      email: "recruiter-new@example.com",
      name: "New Recruiter",
      organizationName: "Fresh Start Cafe",
      organizationType: "Cafe",
      description: "Recently verified free recruiter for new-recruiter hold testing",
      location: "Bangkok",
      area: "Ari",
      blurb: "Verified within the last few days — exercises the new-recruiter daily hold.",
      website: "https://www.facebook.com/paidtalent.seed.newrecruiter",
      contactPhone: "+66811110004",
      lineId: "seed_new_owner",
      hasSubscription: false,
      verificationStatus: "verified",
      venues: [
        {
          name: "Fresh Start Cafe",
          venueType: "Cafe",
          area: "Ari",
          blurb: "Approved primary venue for the new-recruiter fixture.",
          venueLinkUrl: "https://www.facebook.com/paidtalent.seed.newrecruiter",
          venueLinkKind: "facebook",
          reviewStatus: "approved",
          isPrimary: true,
        },
      ],
      openings: [],
    },
    {
      email: "admin@example.com",
      name: "Platform Admin",
      organizationName: "Paid Talent Staff",
      organizationType: "Internal",
      description: "Allowlisted staff account used for local admin dashboard tests",
      location: "Bangkok",
      area: "Sukhumvit",
      blurb: "Internal staff venue for admin full-search testing.",
      contactPhone: "+66811110999",
      lineId: "seed_admin_hr",
      hasSubscription: false,
      verificationStatus: "verified",
      venues: [
        {
          name: "Paid Talent Staff HQ",
          venueType: "Office",
          area: "Sukhumvit",
          blurb: "Approved staff HQ venue so admin can browse as Verified Pro.",
          venueLinkUrl: "https://maps.app.goo.gl/PaidTalentStaffHQ",
          venueLinkKind: "google_maps",
          reviewStatus: "approved",
          isPrimary: true,
        },
      ],
      openings: [
        {
          role: "Host",
          area: "Sukhumvit",
          payMin: 700,
          payMax: 1100,
          isPublished: true,
          venueIndex: 0,
        },
      ],
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
  refuseProductionLikeSeed(process.env.DATABASE_URL);

  let connectionString: string;
  if (allowProductionSeed()) {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error("DATABASE_URL is not set.");
      process.exit(1);
    }
    connectionString = process.env.DATABASE_URL;
    console.warn(
      "⚠️  SEED OVERRIDE: running with --force-production / SEED_ALLOW_PRODUCTION=1"
    );
  } else {
    try {
      connectionString = requireLocalDatabaseUrl(process.env.DATABASE_URL, {
        action: "seed database",
      });
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Refusing to seed database."
      );
      process.exit(1);
    }
  }

  console.log("🌱 Starting database seed...\n");
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Database: ${describeDatabaseTarget(connectionString)}\n`);

  resetSeedMediaStats();
  console.log("🎨 Generating seed assets...");
  const assets = await generateAllSeedAssets();
  if (!assets.livenessMp4 && !assets.livenessWebm) {
    console.warn(
      "   ⚠️  No liveness clip generated (ffmpeg missing). Private liveness keys will still be written; upload skipped."
    );
  }
  const livenessPath = assets.livenessMp4 ?? assets.livenessWebm;
  const livenessExt = assets.livenessMp4 ? "mp4" : "webm";
  const livenessContentType = assets.livenessMp4 ? "video/mp4" : "video/webm";
  const idCardBuffer = readSeedFile(assets.idCard);
  const livenessBuffer = livenessPath ? readSeedFile(livenessPath) : null;
  const uploadedObjectKeys: Array<{ key: string; bucket: "public" | "private" }> =
    [];

  if (!isSeedPublicStorageConfigured() || !isSeedPrivateStorageConfigured()) {
    console.warn(
      "   ⚠️  S3 credentials/buckets incomplete — media uploads will be skipped; DB rows still written."
    );
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const createdWorkers: Array<{
    userId: string;
    profileId: string;
    email: string;
    isTopTalent: boolean;
    verificationStatus: VerificationStatusType;
  }> = [];
  const createdRecruiters: Array<{
    userId: string;
    recruiterProfileId: string;
    email: string;
    hasSubscription: boolean;
    verificationStatus: VerificationStatusType;
  }> = [];

  try {
    // Fail loud if any configured venue link is invalid.
    for (const recruiter of SEED_USERS.recruiters) {
      for (const venue of recruiter.venues ?? []) {
        const parsed = parseVenueLink(venue.venueLinkUrl);
        if (!parsed.ok) {
          throw new Error(
            `Invalid seed venue link for ${recruiter.email} / ${venue.name}: ${parsed.error}`
          );
        }
        venue.venueLinkUrl = parsed.normalizedUrl;
        venue.venueLinkKind = parsed.kind;
      }
    }

    console.log("📦 Seeding workers...");

    let workerIndex = 0;
    for (const worker of SEED_USERS.workers) {
      workerIndex += 1;
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

      const isWorkerVerified = worker.verificationStatus === "verified";
      const needsVerificationMedia =
        worker.verificationStatus === "verified" ||
        worker.verificationStatus === "pending" ||
        worker.verificationStatus === "rejected";

      let photoKey: string | null = null;
      let photoUrl: string | null = null;
      let idDocumentKey: string | null = null;
      let livenessVideoKey: string | null = null;
      let idDocumentSha256: string | null = null;
      let livenessVideoSha256: string | null = null;

      if (isWorkerVerified) {
        const facePath = assets.faces[(workerIndex - 1) % assets.faces.length];
        const faceBuffer = readSeedFile(facePath);
        photoKey = `profiles/${userId}/seed-photo-1.jpg`;
        const uploaded = await uploadPublicSeedObject(
          photoKey,
          faceBuffer,
          "image/jpeg",
          userId
        );
        photoUrl = publicUrlOrPlaceholder(photoKey, uploaded.url);
        if (uploaded.uploaded) {
          uploadedObjectKeys.push({ key: photoKey, bucket: "public" });
        }
      }

      if (needsVerificationMedia) {
        idDocumentKey = `verification-docs/${userId}/seed-id.jpg`;
        const idUpload = await uploadPrivateIdSeedObject(
          idDocumentKey,
          idCardBuffer,
          "image/jpeg",
          userId
        );
        idDocumentSha256 = idUpload.sha256;
        if (idUpload.uploaded) {
          uploadedObjectKeys.push({ key: idDocumentKey, bucket: "private" });
        }

        if (livenessBuffer) {
          livenessVideoKey = `verification-liveness/${userId}/seed-live.${livenessExt}`;
          const liveUpload = await uploadPrivateLivenessSeedObject(
            livenessVideoKey,
            livenessBuffer,
            livenessContentType,
            userId
          );
          livenessVideoSha256 = liveUpload.sha256;
          if (liveUpload.uploaded) {
            uploadedObjectKeys.push({
              key: livenessVideoKey,
              bucket: "private",
            });
          }
        } else {
          livenessVideoKey = `verification-liveness/${userId}/seed-live.mp4`;
        }
      }

      const now = new Date();
      const challengeIssuedAt =
        worker.verificationStatus === "pending"
          ? now
          : needsVerificationMedia
            ? new Date(now.getTime() - 60 * 60 * 1000)
            : null;
      const verificationReviewedAt =
        worker.verificationStatus === "verified" ||
        worker.verificationStatus === "rejected"
          ? now
          : null;

      const profileFields = {
        displayName: worker.displayName,
        location: worker.location,
        area: worker.area,
        description: worker.description,
        bio: worker.bio,
        availability: worker.availability,
        expectedPayMin: worker.expectedPayMin,
        expectedPayMax: null as number | null,
        expectedPayPeriod: worker.expectedPayPeriod,
        payCurrency: "THB",
        jobRoles: worker.jobRoles,
        experienceYears: worker.experienceYears,
        languages: worker.languages,
        lineId: worker.lineId,
        whatsappNumber: worker.whatsappNumber,
        phoneNumber: worker.phoneNumber,
        photoKey,
        photoUrl,
        idDocumentKey,
        livenessVideoKey,
        challengeCode: needsVerificationMedia ? SEED_CHALLENGE_CODE : null,
        challengeIssuedAt,
        idDocumentSubmittedAt: needsVerificationMedia ? now : null,
        verificationReviewedAt,
        verificationReviewedBy: verificationReviewedAt
          ? "admin@example.com"
          : null,
        isPublished: true,
        verificationStatus: worker.verificationStatus,
        isVerified: isWorkerVerified,
        updatedAt: now,
      };

      if (existingProfile.length > 0) {
        profileId = existingProfile[0].id;
        await db
          .update(schema.workerProfiles)
          .set(profileFields)
          .where(eq(schema.workerProfiles.id, profileId));
      } else {
        const [newProfile] = await db
          .insert(schema.workerProfiles)
          .values({
            userId,
            ...profileFields,
            createdAt: now,
          })
          .returning();
        profileId = newProfile.id;
      }

      await db
        .delete(schema.profilePhotos)
        .where(eq(schema.profilePhotos.workerProfileId, profileId));

      if (isWorkerVerified && photoKey && photoUrl) {
        await db.insert(schema.profilePhotos).values({
          userId,
          workerProfileId: profileId,
          photoKey,
          photoUrl,
          moderationStatus: "approved",
          moderationReviewedAt: now,
          moderationReviewedBy: "admin@example.com",
          displayOrder: 0,
          isCurrentApproved: true,
          createdAt: now,
          updatedAt: now,
        });

        if (worker.email === "worker1@example.com") {
          const extraKey = `profiles/${userId}/seed-photo-2.jpg`;
          const extraFace = readSeedFile(assets.faces[1] ?? assets.faces[0]);
          const extraUpload = await uploadPublicSeedObject(
            extraKey,
            extraFace,
            "image/jpeg",
            userId
          );
          if (extraUpload.uploaded) {
            uploadedObjectKeys.push({ key: extraKey, bucket: "public" });
          }
          await db.insert(schema.profilePhotos).values({
            userId,
            workerProfileId: profileId,
            photoKey: extraKey,
            photoUrl: publicUrlOrPlaceholder(extraKey, extraUpload.url),
            moderationStatus: "approved",
            moderationReviewedAt: now,
            moderationReviewedBy: "admin@example.com",
            displayOrder: 1,
            isCurrentApproved: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Pending photo queue fixture on worker4 (still searchable via primary approved photo).
      if (worker.email === "worker4@example.com" && isWorkerVerified) {
        const pendingKey = `profiles/${userId}/seed-photo-pending.jpg`;
        const pendingFace = readSeedFile(assets.faces[3] ?? assets.faces[0]);
        const pendingUpload = await uploadPublicSeedObject(
          pendingKey,
          pendingFace,
          "image/jpeg",
          userId
        );
        if (pendingUpload.uploaded) {
          uploadedObjectKeys.push({ key: pendingKey, bucket: "public" });
        }
        await db.insert(schema.profilePhotos).values({
          userId,
          workerProfileId: profileId,
          photoKey: pendingKey,
          photoUrl: publicUrlOrPlaceholder(pendingKey, pendingUpload.url),
          moderationStatus: "pending",
          displayOrder: 2,
          isCurrentApproved: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (
        (worker.verificationStatus === "verified" ||
          worker.verificationStatus === "rejected") &&
        idDocumentKey
      ) {
        const existingEvent = await db
          .select({ id: schema.verificationEvents.id })
          .from(schema.verificationEvents)
          .where(
            and(
              eq(schema.verificationEvents.workerProfileId, profileId),
              eq(
                schema.verificationEvents.decision,
                worker.verificationStatus === "verified"
                  ? "approved"
                  : "rejected"
              )
            )
          )
          .limit(1);
        if (existingEvent.length === 0) {
          await db.insert(schema.verificationEvents).values({
            userId,
            workerProfileId: profileId,
            decision:
              worker.verificationStatus === "verified"
                ? "approved"
                : "rejected",
            method: "manual_id_review",
            actorType: "admin",
            docType: "thai_id",
            last4: "1234",
            issuingCountry: "TH",
            idDocumentKey,
            idDocumentSha256,
            livenessVideoKey,
            livenessVideoSha256,
            challengeCode: SEED_CHALLENGE_CODE,
            notes: "Seed verification event",
            createdAt: now,
          });
        }
      }

      createdWorkers.push({
        userId,
        profileId,
        email: worker.email,
        isTopTalent: worker.isTopTalent,
        verificationStatus: worker.verificationStatus,
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

      let recruiterProfileId: string;

      const verificationStatus =
        recruiter.verificationStatus ?? ("unverified" as VerificationStatusType);
      const isVerified = verificationStatus === "verified";
      const now = new Date();
      const needsRecruiterMedia =
        verificationStatus === "pending" ||
        verificationStatus === "verified" ||
        verificationStatus === "rejected";

      let idDocumentKey: string | null = null;
      let livenessVideoKey: string | null = null;
      let idDocumentSha256: string | null = null;
      let livenessVideoSha256: string | null = null;

      if (needsRecruiterMedia) {
        idDocumentKey = `verification-docs/${userId}/seed-id.jpg`;
        const idUpload = await uploadPrivateIdSeedObject(
          idDocumentKey,
          idCardBuffer,
          "image/jpeg",
          userId
        );
        idDocumentSha256 = idUpload.sha256;
        if (idUpload.uploaded) {
          uploadedObjectKeys.push({ key: idDocumentKey, bucket: "private" });
        }

        if (livenessBuffer) {
          livenessVideoKey = `verification-liveness/${userId}/seed-live.${livenessExt}`;
          const liveUpload = await uploadPrivateLivenessSeedObject(
            livenessVideoKey,
            livenessBuffer,
            livenessContentType,
            userId
          );
          livenessVideoSha256 = liveUpload.sha256;
          if (liveUpload.uploaded) {
            uploadedObjectKeys.push({
              key: livenessVideoKey,
              bucket: "private",
            });
          }
        } else {
          livenessVideoKey = `verification-liveness/${userId}/seed-live.mp4`;
        }
      }

      const verifiedAtDaysAgo =
        recruiter.email === "recruiter-new@example.com"
          ? 2
          : isVerified
            ? 30
            : null;

      const verificationFields = {
        verificationStatus,
        isVerified,
        verifiedAt:
          verifiedAtDaysAgo != null
            ? new Date(now.getTime() - verifiedAtDaysAgo * 24 * 60 * 60 * 1000)
            : null,
        idDocumentKey,
        livenessVideoKey,
        challengeCode: needsRecruiterMedia ? SEED_CHALLENGE_CODE : null,
        challengeIssuedAt:
          verificationStatus === "pending"
            ? now
            : needsRecruiterMedia
              ? new Date(now.getTime() - 60 * 60 * 1000)
              : null,
        idDocumentSubmittedAt: needsRecruiterMedia ? now : null,
        verificationReviewedAt:
          verificationStatus === "verified" ||
          verificationStatus === "rejected"
            ? now
            : null,
        verificationReviewedBy:
          verificationStatus === "verified" ||
          verificationStatus === "rejected"
            ? "admin@example.com"
            : null,
      };

      if (existingProfile.length > 0) {
        recruiterProfileId = existingProfile[0].id;
        await db
          .update(schema.recruiterProfiles)
          .set({
            organizationName: recruiter.organizationName,
            organizationType: recruiter.organizationType,
            description: recruiter.description,
            location: recruiter.location,
            website: recruiter.website ?? null,
            area: recruiter.area ?? null,
            subArea: recruiter.subArea ?? null,
            blurb: recruiter.blurb ?? null,
            contactEmail: recruiter.contactEmail ?? null,
            contactPhone: recruiter.contactPhone ?? null,
            lineId: recruiter.lineId ?? null,
            ...verificationFields,
            updatedAt: now,
          })
          .where(eq(schema.recruiterProfiles.userId, userId));
      } else {
        const [newProfile] = await db.insert(schema.recruiterProfiles).values({
          userId,
          organizationName: recruiter.organizationName,
          organizationType: recruiter.organizationType,
          description: recruiter.description,
          location: recruiter.location,
          website: recruiter.website ?? null,
          area: recruiter.area ?? null,
          subArea: recruiter.subArea ?? null,
          blurb: recruiter.blurb ?? null,
          contactEmail: recruiter.contactEmail ?? null,
          contactPhone: recruiter.contactPhone ?? null,
          lineId: recruiter.lineId ?? null,
          ...verificationFields,
          createdAt: now,
          updatedAt: now,
        }).returning();
        recruiterProfileId = newProfile.id;
      }

      const seedVenues: SeedVenue[] =
        recruiter.venues && recruiter.venues.length > 0
          ? recruiter.venues
          : [
              {
                name: recruiter.organizationName || "My venue",
                venueType: recruiter.organizationType,
                area: recruiter.area,
                subArea: recruiter.subArea,
                blurb: recruiter.blurb,
                venueLinkUrl:
                  recruiter.website ||
                  "https://www.facebook.com/paidtalent-seed-venue",
                venueLinkKind: "facebook",
                reviewStatus: "pending",
                isPrimary: true,
              },
            ];

      await db
        .delete(schema.recruiterOpenings)
        .where(eq(schema.recruiterOpenings.recruiterProfileId, recruiterProfileId));
      await db
        .delete(schema.venues)
        .where(eq(schema.venues.recruiterProfileId, recruiterProfileId));

      const createdVenueIds: string[] = [];
      let primaryLogoKey: string | null = null;
      let primaryLogoUrl: string | null = null;
      let venueLogoIndex = 0;
      for (const venue of seedVenues) {
        const reviewed =
          venue.reviewStatus === "approved" || venue.reviewStatus === "rejected";
        const logoPath =
          assets.logos[venueLogoIndex % assets.logos.length] ?? assets.logos[0];
        venueLogoIndex += 1;
        const logoKey = `profiles/${userId}/seed-venue-logo-${venueLogoIndex}.png`;
        const logoUpload = await uploadPublicSeedObject(
          logoKey,
          readSeedFile(logoPath),
          "image/png",
          userId
        );
        const logoUrl = publicUrlOrPlaceholder(logoKey, logoUpload.url);
        if (logoUpload.uploaded) {
          uploadedObjectKeys.push({ key: logoKey, bucket: "public" });
        }

        const isPrimary = venue.isPrimary ?? createdVenueIds.length === 0;
        if (isPrimary) {
          primaryLogoKey = logoKey;
          primaryLogoUrl = logoUrl;
        }

        const [createdVenue] = await db
          .insert(schema.venues)
          .values({
            recruiterProfileId,
            name: venue.name,
            venueType: venue.venueType ?? null,
            area: venue.area ?? null,
            subArea: venue.subArea ?? null,
            blurb: venue.blurb ?? null,
            logoKey,
            logoUrl,
            venueLinkUrl: venue.venueLinkUrl,
            venueLinkKind: venue.venueLinkKind,
            reviewStatus: venue.reviewStatus,
            reviewNote: venue.reviewNote ?? null,
            reviewedAt: reviewed ? now : null,
            reviewedBy: reviewed ? "admin@example.com" : null,
            isPrimary,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        createdVenueIds.push(createdVenue.id);
        console.log(
          `   🏢 Venue: ${venue.name} (${venue.reviewStatus}${isPrimary ? ", primary" : ""})`
        );
      }

      if (primaryLogoKey) {
        await db
          .update(schema.recruiterProfiles)
          .set({
            logoKey: primaryLogoKey,
            logoUrl: primaryLogoUrl,
            updatedAt: now,
          })
          .where(eq(schema.recruiterProfiles.id, recruiterProfileId));
      }

      if (
        (verificationStatus === "verified" ||
          verificationStatus === "rejected") &&
        idDocumentKey
      ) {
        const existingEvent = await db
          .select({ id: schema.verificationEvents.id })
          .from(schema.verificationEvents)
          .where(
            and(
              eq(schema.verificationEvents.recruiterProfileId, recruiterProfileId),
              eq(
                schema.verificationEvents.decision,
                verificationStatus === "verified" ? "approved" : "rejected"
              )
            )
          )
          .limit(1);
        if (existingEvent.length === 0) {
          await db.insert(schema.verificationEvents).values({
            userId,
            recruiterProfileId,
            decision:
              verificationStatus === "verified" ? "approved" : "rejected",
            method: "manual_id_review",
            actorType: "admin",
            docType: "thai_id",
            last4: "1234",
            issuingCountry: "TH",
            idDocumentKey,
            idDocumentSha256,
            livenessVideoKey,
            livenessVideoSha256,
            challengeCode: SEED_CHALLENGE_CODE,
            notes: "Seed recruiter verification event",
            createdAt: now,
          });
        }
      }

      if (recruiter.openings && recruiter.openings.length > 0) {
        for (const opening of recruiter.openings) {
          const venueIndex = opening.venueIndex ?? 0;
          const venueId =
            createdVenueIds[venueIndex] ?? createdVenueIds[0] ?? null;
          await db.insert(schema.recruiterOpenings).values({
            recruiterProfileId,
            venueId,
            role: opening.role,
            area: opening.area,
            payMin: opening.payMin ?? null,
            payMax: opening.payMax ?? null,
            payCurrency: "THB",
            payPeriod: "night",
            notes: opening.notes ?? null,
            isPublished: opening.isPublished ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`   📋 Opening: ${opening.role} at ${opening.area} (${opening.isPublished ? "published" : "draft"})`);
        }
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
              billingProduct: "monthly",
              stripePriceId: "price_seed_monthly",
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
            stripePriceId: "price_seed_monthly",
            status: "active",
            plan: "top_talent_unlock",
            billingProduct: "monthly",
            launchDiscountApplied: false,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        console.log(`   💳 Subscription active for: ${recruiter.email}`);
      }

      if (recruiter.email === "recruiter-pass@example.com") {
        const existingPass = await db
          .select({ id: schema.topTalentPasses.id })
          .from(schema.topTalentPasses)
          .where(eq(schema.topTalentPasses.userId, userId))
          .limit(1);
        if (existingPass.length === 0) {
          const startsAt = new Date();
          const expiresAt = new Date(startsAt.getTime() + 5 * 24 * 60 * 60 * 1000);
          await db.insert(schema.topTalentPasses).values({
            userId,
            stripeCheckoutSessionId: `cs_seed_pass_${userId.slice(0, 8)}`,
            amountTotal: 49000,
            currency: "thb",
            usedFirstPassCoupon: false,
            startsAt,
            expiresAt,
            createdAt: startsAt,
          });
        }
        console.log(`   🎟️  Top Talent pass active for: ${recruiter.email}`);
      }

      if (recruiter.email === "admin@example.com") {
        await upsertAdminEntitlement({
          userId,
          requested: { kind: "lifetime" },
          reason: "Seed lifetime grant for admin full-search testing",
          adminEmail: "admin@example.com",
          now,
        });
        console.log(`   ♾️  Lifetime admin grant for: ${recruiter.email}`);
      }

      createdRecruiters.push({
        userId,
        recruiterProfileId,
        email: recruiter.email,
        hasSubscription: recruiter.hasSubscription,
        verificationStatus,
      });
    }

    console.log("\n📦 Seeding profile views for Top Talent ranking...");

    // Composite ranking needs DISTINCT viewerUserId counts (null viewers don't count).
    const rankingViewerIds: string[] = [];
    for (let i = 1; i <= TOP_TALENT_VIEW_COUNT; i++) {
      const email = `seed-viewer-${i}@example.com`;
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (existing[0]) {
        rankingViewerIds.push(existing[0].id);
        continue;
      }
      const [viewer] = await db
        .insert(schema.users)
        .values({
          email,
          name: `Seed Viewer ${i}`,
          role: "recruiter",
          ageVerified: true,
          dateOfBirth: generateDateOfBirth(),
          ageVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: schema.users.id });
      rankingViewerIds.push(viewer.id);
    }

    for (const worker of createdWorkers) {
      await db
        .delete(schema.profileViews)
        .where(eq(schema.profileViews.workerProfileId, worker.profileId));

      const viewCount = worker.isTopTalent
        ? TOP_TALENT_VIEW_COUNT
        : NORMAL_VIEW_COUNT;

      const viewsToInsert = [];
      for (let i = 0; i < viewCount; i++) {
        const viewedAt = new Date();
        viewedAt.setDate(viewedAt.getDate() - Math.floor(Math.random() * 25));

        viewsToInsert.push({
          workerProfileId: worker.profileId,
          viewerUserId: worker.isTopTalent
            ? rankingViewerIds[i]!
            : rankingViewerIds[i % rankingViewerIds.length]!,
          viewerIpHash: `seed_hash_${i}_${worker.profileId.slice(0, 8)}`,
          viewedAt,
        });
      }

      if (viewsToInsert.length > 0) {
        await db.insert(schema.profileViews).values(viewsToInsert);
      }

      const status = worker.isTopTalent ? "⭐ Top Talent" : "   Normal";
      console.log(
        `   ${status}: ${worker.email} (${viewCount} unique views)`
      );
    }

    console.log("\n📦 Seeding contact requests (pending/accepted/declined/expired)...");

    const topTalentWorkers = createdWorkers.filter((w) => w.isTopTalent);
    const normalWorkers = createdWorkers.filter((w) => !w.isTopTalent);
    const createdRequests: Array<{
      contactRequestId: string;
      recruiterEmail: string;
      workerEmail: string;
      status: string;
    }> = [];

    type SeedStatus = "pending" | "accepted" | "declined" | "expired";
    const statusCycle: SeedStatus[] = [
      "pending",
      "accepted",
      "declined",
      "expired",
    ];

    for (const recruiter of createdRecruiters) {
      // Contact requests require verified recruiters (same gate as the API).
      if (recruiter.verificationStatus !== "verified") continue;

      // Every verified recruiter contacts all Top Talent workers so interest score can clear TT threshold.
      const workersToContact = [
        ...topTalentWorkers,
        ...(recruiter.hasSubscription
          ? normalWorkers.slice(0, 2)
          : recruiter.email === "recruiter-free@example.com" ||
              recruiter.email === "admin@example.com"
            ? normalWorkers.slice(0, 2)
            : normalWorkers.slice(0, 1)),
      ];

      const [recruiterProfile] = await db
        .select({ id: schema.recruiterProfiles.id })
        .from(schema.recruiterProfiles)
        .where(eq(schema.recruiterProfiles.userId, recruiter.userId))
        .limit(1);

      if (!recruiterProfile) continue;

      const [primaryVenue] = await db
        .select({ id: schema.venues.id })
        .from(schema.venues)
        .where(
          and(
            eq(schema.venues.recruiterProfileId, recruiterProfile.id),
            eq(schema.venues.isPrimary, true)
          )
        )
        .limit(1);

      const recruiterOpeningsList = await db
        .select({
          id: schema.recruiterOpenings.id,
          role: schema.recruiterOpenings.role,
        })
        .from(schema.recruiterOpenings)
        .where(
          and(
            eq(schema.recruiterOpenings.recruiterProfileId, recruiterProfile.id),
            eq(schema.recruiterOpenings.isPublished, true)
          )
        );

      for (let i = 0; i < workersToContact.length; i++) {
        const worker = workersToContact[i];
        const linkedOpening =
          recruiterOpeningsList[i % Math.max(recruiterOpeningsList.length, 1)];
        // Prefer pending/accepted for Top Talent so ranking interest score can fire.
        const seedStatus: SeedStatus = worker.isTopTalent
          ? i % 2 === 0
            ? "pending"
            : "accepted"
          : statusCycle[i % statusCycle.length];
        const now = new Date();
        const openerText = recruiter.hasSubscription
          ? `We have an exciting ${linkedOpening?.role || "opportunity"} position for you at our venue!`
          : "Interested in discussing a position with you.";

        const existing = await db
          .select()
          .from(schema.contactRequests)
          .where(
            and(
              eq(schema.contactRequests.recruiterUserId, recruiter.userId),
              eq(schema.contactRequests.workerProfileId, worker.profileId)
            )
          )
          .limit(1);

        let contactRequestId: string;
        if (existing.length === 0) {
          const deliveredAt =
            seedStatus === "pending" ||
            seedStatus === "accepted" ||
            seedStatus === "declined" ||
            seedStatus === "expired"
              ? now
              : null;
          const [created] = await db
            .insert(schema.contactRequests)
            .values({
              recruiterUserId: recruiter.userId,
              recruiterProfileId: recruiterProfile.id,
              venueId: primaryVenue?.id ?? null,
              workerProfileId: worker.profileId,
              workerUserId: worker.userId,
              openingId: linkedOpening?.id ?? null,
              openerText,
              status: seedStatus,
              isPro: recruiter.hasSubscription,
              countsTowardCaps: false,
              deliveredAt,
              respondedAt:
                seedStatus === "accepted" || seedStatus === "declined"
                  ? now
                  : null,
              expiresAt:
                seedStatus === "expired"
                  ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
                  : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          contactRequestId = created.id;
          console.log(
            `   ✅ ${seedStatus}: ${recruiter.email} → ${worker.email}`
          );
        } else {
          contactRequestId = existing[0].id;
        }

        if (seedStatus === "accepted") {
          await db
            .insert(schema.profileInterests)
            .values({
              id: contactRequestId,
              recruiterUserId: recruiter.userId,
              workerProfileId: worker.profileId,
              openingId: linkedOpening?.id ?? null,
              message: openerText,
              createdAt: now,
            })
            .onConflictDoNothing({ target: schema.profileInterests.id });

          const [existingConvo] = await db
            .select({ id: schema.conversations.id })
            .from(schema.conversations)
            .where(eq(schema.conversations.contactRequestId, contactRequestId))
            .limit(1);
          if (!existingConvo) {
            await db.insert(schema.conversations).values({
              contactRequestId,
              recruiterUserId: recruiter.userId,
              workerUserId: worker.userId,
              workerProfileId: worker.profileId,
              venueId: primaryVenue?.id ?? null,
              lastActivityAt: now,
              retentionExpiresAt: new Date(
                now.getTime() + 180 * 24 * 60 * 60 * 1000
              ),
              createdAt: now,
            });
          }
        }

        createdRequests.push({
          contactRequestId,
          recruiterEmail: recruiter.email,
          workerEmail: worker.email,
          status: seedStatus,
        });
      }
    }

    const createdInterests = createdRequests
      .filter((r) => r.status === "accepted" || r.status === "pending")
      .map((r) => ({
        interestId: r.contactRequestId,
        recruiterEmail: r.recruiterEmail,
        workerEmail: r.workerEmail,
      }));

    console.log("\n📦 Seeding chat messages (demo thread)...");
    const demoRequest = createdRequests.find(
      (r) =>
        r.status === "accepted" &&
        r.recruiterEmail === "recruiter-pro@example.com" &&
        r.workerEmail === "worker2@example.com"
    );
    if (demoRequest) {
      const [demoConvo] = await db
        .select()
        .from(schema.conversations)
        .where(
          eq(schema.conversations.contactRequestId, demoRequest.contactRequestId)
        )
        .limit(1);

      if (demoConvo) {
        const [existingMsg] = await db
          .select({ id: schema.messages.id })
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, demoConvo.id))
          .limit(1);

        if (!existingMsg) {
          const [reqRow] = await db
            .select()
            .from(schema.contactRequests)
            .where(eq(schema.contactRequests.id, demoRequest.contactRequestId))
            .limit(1);

          const nowChat = new Date();
          if (reqRow) {
            await db.insert(schema.messages).values({
              conversationId: demoConvo.id,
              senderUserId: reqRow.recruiterUserId,
              kind: "text",
              body: reqRow.openerText,
              createdAt: reqRow.createdAt,
            });
          }

          await db.insert(schema.messages).values({
            conversationId: demoConvo.id,
            senderUserId: demoConvo.workerUserId,
            kind: "text",
            body: "Thanks for reaching out — when would you like me to start?",
            createdAt: new Date(nowChat.getTime() - 3600_000),
          });

          const [workerProfile] = await db
            .select({ lineId: schema.workerProfiles.lineId })
            .from(schema.workerProfiles)
            .where(eq(schema.workerProfiles.id, demoConvo.workerProfileId))
            .limit(1);

          const lineValue = workerProfile?.lineId?.trim() ?? "seed_worker_line";
          const [shareMsg] = await db
            .insert(schema.messages)
            .values({
              conversationId: demoConvo.id,
              senderUserId: demoConvo.workerUserId,
              kind: "contact_share",
              body: `LINE: ${lineValue}`,
              createdAt: new Date(nowChat.getTime() - 1800_000),
            })
            .returning();

          await db.insert(schema.contactShares).values({
            conversationId: demoConvo.id,
            messageId: shareMsg.id,
            sharerUserId: demoConvo.workerUserId,
            recipientUserId: demoConvo.recruiterUserId,
            channel: "line",
            createdAt: shareMsg.createdAt,
          });

          const [flaggedMsg] = await db
            .insert(schema.messages)
            .values({
              conversationId: demoConvo.id,
              senderUserId: demoConvo.recruiterUserId,
              kind: "text",
              body: "Please pay a small deposit before we confirm the shift.",
              isFlagged: true,
              createdAt: nowChat,
            })
            .returning();

          await db.insert(schema.messageFlags).values({
            targetType: "message",
            messageId: flaggedMsg.id,
            conversationId: demoConvo.id,
            authorUserId: demoConvo.recruiterUserId,
            categories: ["money_request"],
            matchedTerms: ["deposit"],
            createdAt: nowChat,
          });

          await db
            .update(schema.conversations)
            .set({
              lastMessageAt: nowChat,
              lastActivityAt: nowChat,
            })
            .where(eq(schema.conversations.id, demoConvo.id));

          console.log(
            "   ✅ Demo chat: text messages, LINE share, flagged deposit message"
          );
        }
      }
    }

    console.log("\n📦 Seeding safety fixtures (report, block, messaging pause)...");
    const seedWorker2 = createdWorkers.find(
      (w) => w.email === "worker2@example.com"
    );
    const seedWorker1 = createdWorkers.find(
      (w) => w.email === "worker1@example.com"
    );
    const seedRecruiterPro = createdRecruiters.find(
      (r) => r.email === "recruiter-pro@example.com"
    );
    const seedRecruiterFree = createdRecruiters.find(
      (r) => r.email === "recruiter-free@example.com"
    );

    if (seedWorker2 && seedRecruiterPro && demoRequest) {
      const [existingReport] = await db
        .select({ id: schema.reports.id })
        .from(schema.reports)
        .where(eq(schema.reports.reporterUserId, seedWorker2.userId))
        .limit(1);

      if (!existingReport) {
        const [demoConvoForReport] = await db
          .select({ id: schema.conversations.id })
          .from(schema.conversations)
          .where(
            eq(
              schema.conversations.contactRequestId,
              demoRequest.contactRequestId
            )
          )
          .limit(1);

        await db.insert(schema.reports).values({
          reporterUserId: seedWorker2.userId,
          reportedUserId: seedRecruiterPro.userId,
          contactRequestId: demoRequest.contactRequestId,
          conversationId: demoConvoForReport?.id ?? null,
          reason: "asked_for_money",
          details: "Seeded open report for admin queue triage.",
          evidenceSnapshot: {
            request: null,
            messages: [],
          },
          status: "open",
        });
        console.log("   ✅ Open report (worker2 → recruiter-pro)");
      }
    }

    if (seedWorker1 && seedRecruiterFree) {
      const [existingBlock] = await db
        .select({ id: schema.userBlocks.id })
        .from(schema.userBlocks)
        .where(
          and(
            eq(schema.userBlocks.blockerUserId, seedWorker1.userId),
            eq(schema.userBlocks.blockedUserId, seedRecruiterFree.userId)
          )
        )
        .limit(1);

      if (!existingBlock) {
        await db.insert(schema.userBlocks).values({
          blockerUserId: seedWorker1.userId,
          blockedUserId: seedRecruiterFree.userId,
        });
        console.log("   ✅ Block (worker1 blocks recruiter-free)");
      }

      await db
        .update(schema.recruiterProfiles)
        .set({
          messagingPausedAt: new Date(),
          messagingPausedReason: "system:auto_reports",
          messagingPausedBy: "system:auto_reports",
          updatedAt: new Date(),
        })
        .where(eq(schema.recruiterProfiles.id, seedRecruiterFree.recruiterProfileId));
      console.log("   ✅ Auto-paused recruiter (recruiter-free)");
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
      let interest = createdInterests.find(
        (i) =>
          i.recruiterEmail === outcomeSeed.recruiterEmail &&
          i.workerEmail === outcomeSeed.workerEmail
      );

      const requestRow = createdRequests.find(
        (r) =>
          r.recruiterEmail === outcomeSeed.recruiterEmail &&
          r.workerEmail === outcomeSeed.workerEmail
      );

      if (requestRow) {
        const nowAccept = new Date();
        await db
          .update(schema.contactRequests)
          .set({
            status: "accepted",
            respondedAt: nowAccept,
            deliveredAt: nowAccept,
            updatedAt: nowAccept,
          })
          .where(eq(schema.contactRequests.id, requestRow.contactRequestId));

        const [req] = await db
          .select()
          .from(schema.contactRequests)
          .where(eq(schema.contactRequests.id, requestRow.contactRequestId))
          .limit(1);

        if (req) {
          await db
            .insert(schema.profileInterests)
            .values({
              id: req.id,
              recruiterUserId: req.recruiterUserId,
              workerProfileId: req.workerProfileId,
              openingId: req.openingId,
              message: req.openerText,
              createdAt: req.createdAt,
            })
            .onConflictDoNothing({ target: schema.profileInterests.id });

          const [existingConvo] = await db
            .select({ id: schema.conversations.id })
            .from(schema.conversations)
            .where(eq(schema.conversations.contactRequestId, req.id))
            .limit(1);
          if (!existingConvo) {
            await db.insert(schema.conversations).values({
              contactRequestId: req.id,
              recruiterUserId: req.recruiterUserId,
              workerUserId: req.workerUserId,
              workerProfileId: req.workerProfileId,
              venueId: req.venueId,
              lastActivityAt: nowAccept,
              retentionExpiresAt: new Date(
                nowAccept.getTime() + 180 * 24 * 60 * 60 * 1000
              ),
              createdAt: req.createdAt,
            });
          }
        }

        interest = {
          interestId: requestRow.contactRequestId,
          recruiterEmail: requestRow.recruiterEmail,
          workerEmail: requestRow.workerEmail,
        };
      }

      if (!interest) {
        console.log(`   ⚠️  Contact request not found for ${outcomeSeed.recruiterEmail} → ${outcomeSeed.workerEmail}`);
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
          contactRequestId: interest.interestId,
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
            contactRequestId: interest.interestId,
            updatedAt: now,
          })
          .where(eq(schema.hireOutcomes.id, existingOutcome[0].id));
        console.log(`   ♻️  ${outcomeSeed.status.toUpperCase()}: ${outcomeSeed.recruiterEmail} → ${outcomeSeed.workerEmail}`);
      }
    }

    printSeedMediaSummary();

    console.log("\n🔎 Seed self-check...");
    const expectedTiers: Record<string, "unverified" | "free" | "pro"> = {
      "recruiter-unverified@example.com": "unverified",
      "recruiter-pending@example.com": "unverified",
      "recruiter-rejected@example.com": "unverified",
      "recruiter-free@example.com": "free",
      "recruiter-new@example.com": "free",
      "recruiter-pro@example.com": "pro",
      "recruiter-pass@example.com": "pro",
      "admin@example.com": "pro",
    };
    const tierFailures: string[] = [];
    for (const [email, expected] of Object.entries(expectedTiers)) {
      const recruiter = createdRecruiters.find((r) => r.email === email);
      if (!recruiter) {
        tierFailures.push(`${email}: missing`);
        continue;
      }
      const access = await getRecruiterAccess(recruiter.userId);
      console.log(`   ${email} → tier=${access.tier} (expected ${expected})`);
      if (access.tier !== expected) {
        tierFailures.push(`${email}: got ${access.tier}, expected ${expected}`);
      }
    }

    const searchableFailures: string[] = [];
    const expectedSearchable = [
      "worker1@example.com",
      "worker2@example.com",
      "worker3@example.com",
      "worker4@example.com",
      "worker5@example.com",
    ];
    for (const email of expectedSearchable) {
      const worker = createdWorkers.find((w) => w.email === email);
      if (!worker) {
        searchableFailures.push(`${email}: missing`);
        continue;
      }
      const [profile] = await db
        .select()
        .from(schema.workerProfiles)
        .where(eq(schema.workerProfiles.id, worker.profileId))
        .limit(1);
      const result = isSearchableWorker(profile ?? null);
      console.log(
        `   searchable ${email}: ${result.isSearchable} (${result.reason})`
      );
      if (!result.isSearchable) {
        searchableFailures.push(`${email}: ${result.reason}`);
      }
    }

    const ttFailures: string[] = [];
    for (const email of [
      "worker1@example.com",
      "worker2@example.com",
      "worker3@example.com",
    ]) {
      const worker = createdWorkers.find((w) => w.email === email);
      if (!worker) continue;
      const isTT = await isProfileTopTalent(worker.profileId);
      console.log(`   Top Talent ${email}: ${isTT}`);
      if (!isTT) {
        ttFailures.push(email);
        console.warn(`   ⚠️  ${email} is not Top Talent at runtime`);
      }
    }

    const openingFailures: string[] = [];
    const publishedOpenings = await db
      .select({
        id: schema.recruiterOpenings.id,
        venueId: schema.recruiterOpenings.venueId,
        reviewStatus: schema.venues.reviewStatus,
      })
      .from(schema.recruiterOpenings)
      .leftJoin(
        schema.venues,
        eq(schema.venues.id, schema.recruiterOpenings.venueId)
      )
      .where(eq(schema.recruiterOpenings.isPublished, true));
    for (const opening of publishedOpenings) {
      if (!opening.venueId || opening.reviewStatus !== "approved") {
        openingFailures.push(opening.id);
      }
    }

    if (
      isSeedPublicStorageConfigured() &&
      isSeedPrivateStorageConfigured() &&
      uploadedObjectKeys.length > 0
    ) {
      const missing = await assertSeedObjectsExist(uploadedObjectKeys);
      if (missing.length > 0) {
        console.error("   ❌ Missing uploaded objects:", missing.slice(0, 10));
        throw new Error(`Seed media HEAD check failed (${missing.length} missing)`);
      }
      console.log(`   ✅ HEAD ok for ${uploadedObjectKeys.length} uploaded objects`);
    }

    if (
      tierFailures.length > 0 ||
      searchableFailures.length > 0 ||
      openingFailures.length > 0
    ) {
      console.error("   ❌ Self-check failures:");
      for (const line of [
        ...tierFailures,
        ...searchableFailures,
        ...openingFailures.map((id) => `opening ${id} not on approved venue`),
      ]) {
        console.error(`      - ${line}`);
      }
      throw new Error("Seed self-check failed");
    }
    if (ttFailures.length > 0) {
      console.warn(
        `   ⚠️  Top Talent self-check soft-fail: ${ttFailures.join(", ")}`
      );
    } else {
      console.log("   ✅ Self-check passed");
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

    // Ensure platform settings exist (default billing mode = enforced).
    // Toggle to open_access in admin to exercise free + canViewTopTalentFull.
    await db
      .insert(schema.platformSettings)
      .values({
        id: schema.PLATFORM_SETTINGS_ID,
        billingAccessMode: "enforced",
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(schema.billingPriceSettings)
      .values({
        id: schema.BILLING_PRICE_SETTINGS_ID,
        monthlyPriceId: "price_seed_monthly",
        annualPriceId: "price_seed_annual",
        pass7dPriceId: "price_seed_pass_7d",
        launchCouponId: "coupon_seed_launch",
        launchEnabled: false,
        launchSeatsLimit: 50,
        firstPassCouponId: "coupon_seed_first_pass",
        updatedAt: new Date(),
        updatedBy: "seed",
      })
      .onConflictDoNothing();

    // Default messaging caps (editable in Admin → Settings).
    await db
      .insert(schema.messagingSettings)
      .values({
        id: schema.MESSAGING_SETTINGS_ID,
        freeDailyNew: 3,
        freeWeeklyNew: 10,
        freePendingMax: 5,
        freeOpenerMaxChars: 300,
        freeCanAttachOpening: false,
        freeMaxVenues: 1,
        paidDailyNew: 20,
        paidWeeklyNew: 100,
        paidDailyTopTalent: 10,
        paidPendingMax: 25,
        paidOpenerMaxChars: 1000,
        paidMaxVenues: 5,
        newRecruiterDailyCap: 5,
        newRecruiterWindowDays: 7,
        workerInboundDailyDefault: 10,
        followUpAfterHours: 48,
        requestExpiryDays: 14,
        declineCooldownDays: 30,
        messageMaxChars: 2000,
        autoPauseReportThreshold: 3,
        autoPauseWindowDays: 30,
        notifyCooldownMinutes: 15,
        lineMonthlyPushBudget: 300,
        retentionDays: 180,
        updatedAt: new Date(),
        updatedBy: "seed",
      })
      .onConflictDoNothing();

    // Seed one active 7-day pass (alongside the paid subscription on recruiter-pro).
    const passRecruiter = createdRecruiters.find(
      (r) => r.email === "recruiter-pro@example.com"
    );
    if (passRecruiter) {
      const passStart = new Date();
      const passEnd = new Date(passStart.getTime());
      passEnd.setUTCDate(passEnd.getUTCDate() + 7);
      await db
        .insert(schema.topTalentPasses)
        .values({
          userId: passRecruiter.userId,
          stripeCheckoutSessionId: `cs_seed_pass_${passRecruiter.userId.slice(0, 8)}`,
          stripePaymentIntentId: `pi_seed_pass_${passRecruiter.userId.slice(0, 8)}`,
          amountTotal: 39000,
          currency: "thb",
          usedFirstPassCoupon: true,
          startsAt: passStart,
          expiresAt: passEnd,
          createdAt: passStart,
        })
        .onConflictDoNothing();
      console.log(`   🎟️  7-day pass active for: ${passRecruiter.email}`);
    }

    console.log("💬 MESSAGING CAPS:");
    console.log("-".repeat(40));
    console.log("   messaging_settings seeded (Admin → Settings → Messaging limits)");
    console.log(
      "   near daily cap fixture → recruiter-free@ (2 of 3 free daily once requests land)"
    );
    console.log("");

    console.log("🏢 RECRUITERS (access tiers):");
    console.log("-".repeat(40));
    console.log(
      "   unverified → recruiter-unverified@ (teaser browse)"
    );
    console.log(
      "   free       → recruiter-free@ (verified + approved venue; near messaging daily cap)"
    );
    console.log(
      "   pro/paid   → recruiter-pro@ (subscription)"
    );
    console.log(
      "   open_access viewing → set billing mode to open_access; free recruiter keeps tier free"
    );
    console.log("");
    for (const recruiter of SEED_USERS.recruiters) {
      const status = recruiter.hasSubscription ? "💳 Subscribed" : "🆓 Free";
      console.log(`${status}`);
      console.log(`   Email: ${recruiter.email}`);
      console.log(`   Name:  ${recruiter.name}`);
      console.log(`   Org:   ${recruiter.organizationName}`);
      console.log(`   Area:  ${recruiter.area || "N/A"}${recruiter.subArea ? `, ${recruiter.subArea}` : ""}`);
      if (recruiter.blurb) {
        console.log(`   Blurb: ${recruiter.blurb.slice(0, 50)}${recruiter.blurb.length > 50 ? "..." : ""}`);
      }
      if (recruiter.openings && recruiter.openings.length > 0) {
        console.log(`   Openings: ${recruiter.openings.length} (${recruiter.openings.filter(o => o.isPublished).length} published)`);
      }
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
