# Paid Talent - Architecture Documentation

This document outlines the API and route boundaries, conventions, and system architecture for the Paid Talent platform.

## Table of Contents

1. [Overview](#overview)
2. [Route Groups](#route-groups)
3. [API Conventions](#api-conventions)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Top Talent Ranking System](#top-talent-ranking-system)
7. [Contact Visibility Rules](#contact-visibility-rules)
8. [Media Storage](#media-storage)
9. [Stripe Integration](#stripe-integration)
10. [Moderation System](#moderation-system)

---

## Overview

Paid Talent is a Next.js 14+ application using:

- **Framework**: Next.js App Router with TypeScript
- **Styling**: Tailwind CSS (mobile-first)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Auth.js (NextAuth v5)
- **Storage**: S3-compatible object storage
- **Payments**: Stripe subscriptions
- **Ads**: Google AdSense (stubbed)

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # API route handlers
│   ├── auth/              # Auth pages (signin, role-select, age-verification)
│   ├── admin/             # Internal admin review console
│   ├── worker/            # Worker-only pages
│   └── recruiter/         # Recruiter-only pages
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components (Header, Footer)
│   ├── auth/             # Auth-related components
│   └── ads/              # AdSense components
├── lib/                   # Shared libraries
│   ├── auth/             # Auth.js configuration
│   ├── db/               # Drizzle schema & client
│   ├── storage/          # S3 utilities
│   ├── stripe/           # Stripe integration
│   ├── ranking/          # Top Talent ranking system
│   └── moderation/       # Content moderation
└── types/                 # TypeScript type definitions
```

---

## Route Groups

### Auth Routes (`/auth/*`)

| Route | Type | Description |
|-------|------|-------------|
| `/auth/role-select` | Page | Role selection (worker/recruiter) before signup |
| `/auth/age-verification` | Page | 18+ age verification gate |
| `/auth/signin` | Page | Sign in with Google or email |
| `/auth/error` | Page | Auth error display |
| `/api/auth/[...nextauth]` | API | NextAuth.js handlers |
| `/api/auth/register` | API | User registration with role & DOB |

### Worker Routes (`/worker/*`)

| Route | Type | Description |
|-------|------|-------------|
| `/worker/dashboard` | Page | Worker dashboard (stats, quick actions) |
| `/worker/profile` | Page | Profile editor |

**Access**: Worker role only (middleware enforced)

### Recruiter Routes (`/recruiter/*`)

| Route | Type | Description |
|-------|------|-------------|
| `/recruiter/dashboard` | Page | Recruiter dashboard |
| `/recruiter/search` | Page | Worker search with filters |

**Access**: Recruiter role only (middleware enforced)

### Admin Routes (`/admin/*`)

| Route | Type | Description |
|-------|------|-------------|
| `/admin` | Page | Admin overview with pending counts |
| `/admin/verifications` | Page | Pending worker identity verification queue |
| `/admin/photos` | Page | Quarantined photo moderation queue |

**Access**: Authenticated users whose email is in server-side `ADMIN_EMAILS` (comma-separated). Unauthenticated visitors are redirected to `/auth/signin?callbackUrl=…`. Non-allowlisted authenticated users receive `notFound()`. Admin page guards are additive; `/api/admin/*` remains independently protected via `isAdminEmail()`. Never expose `ADMIN_EMAILS` through `NEXT_PUBLIC_*`.

### Media Routes (`/api/media/*`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/media/upload` | POST | Generate presigned upload URL |
| `/api/media/upload` | PUT | Confirm upload & trigger moderation |

### Subscription Routes (`/api/stripe/*`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/stripe/checkout` | POST | Create Stripe Checkout session |
| `/api/stripe/portal` | POST | Create Stripe Customer Portal session |
| `/api/stripe/webhook` | POST | Handle Stripe webhook events |

### Interest Routes (`/api/interests`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/interests` | POST | Create interest (recruiter → worker) |
| `/api/interests` | GET | List interests (role-specific view) |

---

## API Conventions

### Server Actions vs Route Handlers

| Use Case | Approach | Location |
|----------|----------|----------|
| Form submissions | Server Actions | In page/component |
| Simple mutations | Server Actions | In page/component |
| External webhooks | Route Handlers | `/api/*` |
| Presigned URLs | Route Handlers | `/api/*` |
| Complex data fetching | Route Handlers | `/api/*` |
| Third-party callbacks | Route Handlers | `/api/*` |

### Response Format

```typescript
// Success response
{
  success: true,
  data: { ... }
}

// Error response
{
  error: "Error message",
  details?: [...] // Validation errors
}
```

### Authentication

All protected routes check:
1. Session exists (`auth()`)
2. User is age-verified (`session.user.ageVerified`)
3. User has correct role (where applicable)

---

## Local Development & Migrations

### After Pulling Changes

When you pull changes that include schema updates (new migrations), update your local database:

```bash
npm run db:migrate
npm run db:seed  # Optional: refresh sample data
```

### Migration Errors

**"type already exists" (42710)** — Your database has schema objects but the migration journal is out of sync. Run:

```bash
npm run db:repair
```

**"column does not exist" (42703)** — Schema is behind. The API will return a 503 with a helpful message pointing to `db:repair` or `db:migrate`.

### Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:repair` | Fix journal desync (use when migrate fails) |
| `npm run db:seed` | Populate sample data (dev only) |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:studio` | Open Drizzle Studio (database UI) |

### Nuclear Option

If repair doesn't work, reset the database completely and re-run setup. See [README](../README.md#local-development-after-git-pull) for instructions.

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | Core user data, role, age verification |
| `accounts` | OAuth accounts (Auth.js) |
| `sessions` | User sessions (Auth.js) |
| `verification_tokens` | Email verification (Auth.js) |
| `worker_profiles` | Worker profile data, contact info |
| `recruiter_profiles` | Recruiter/org profile data |
| `profile_views` | Track profile views for ranking |
| `profile_interests` | Recruiter → Worker interest records |
| `subscriptions` | Stripe subscription data |

### Key Relationships

```
users
 ├── worker_profiles (1:1)
 ├── recruiter_profiles (1:1)
 ├── subscriptions (1:1)
 ├── accounts (1:many)
 └── sessions (1:many)

worker_profiles
 ├── profile_views (1:many)
 └── profile_interests (1:many)
```

---

## Authentication & Authorization

### Flow

1. **Role Selection** (`/auth/role-select`)
   - User chooses Worker or Recruiter
   - Stored in URL params for registration

2. **Age Verification** (`/auth/age-verification`)
   - Date of birth input
   - 18+ confirmation checkbox
   - Under-18 users are **blocked**

3. **Sign In** (`/auth/signin`)
   - Google OAuth or email magic link
   - Role/DOB passed to registration endpoint

4. **Registration** (`/api/auth/register`)
   - Creates user with role & verified DOB
   - Creates empty profile (worker or recruiter)

### Middleware Protection

```typescript
// src/middleware.ts
- Public routes: /, /auth/*, /api/auth/*
- Age gate: All authenticated routes require ageVerified
- Role routes: /worker/* requires worker role
              /recruiter/* requires recruiter role
```

---

## Top Talent Ranking System

### Location

```
src/lib/ranking/index.ts
src/lib/helpers/ranking.ts  (scoring functions & weights)
```

### Pluggable Interface

```typescript
interface RankingProvider {
  name: string;
  calculateScore(profileId: string, criteria?: RankingCriteria): Promise<number>;
  isTopTalent(profileId: string, criteria?: RankingCriteria): Promise<boolean>;
  getRankedProfiles(limit: number, offset: number, criteria?: RankingCriteria): Promise<RankedWorkerProfile[]>;
}
```

### Default Implementation: Composite Ranking v1.1

The default `CompositeRankingProvider` (v1.1) calculates a composite score (0-100) from four weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Profile Completeness | 25% (0-25 pts) | Rewards complete profiles based on required onboarding steps |
| Unique Recruiter Views | 30% (0-30 pts) | Counts distinct recruiter views with logarithmic diminishing returns |
| Interest Rate | 25% (0-25 pts) | Counts recruiter interests received with logarithmic scaling |
| Recency | 20% (0-20 pts) | Linear decay favoring recently updated profiles |

**Scoring Details:**

1. **Profile Completeness**: Uses existing `getProfileCompleteness()` which calculates completion percentage based on 7 required onboarding steps (photo, name, roles, experience, languages, bio, location/availability).

2. **Unique Recruiter Views**: Uses logarithmic scaling to provide diminishing returns. A profile with 15 unique recruiter views in the time window achieves near-maximum score. Formula: `log(views + 1) / log(cap + 1)`.

3. **Interest Rate**: Counts total interests received from recruiters. Uses same logarithmic scaling; ~10 interests yields maximum score.

4. **Recency**: Linear decay from max points at update time to 0 at the time window boundary (default 30 days). Fresh profiles are rewarded; stale profiles lose recency points.

**Top Talent Threshold**: A profile is "Top Talent" if its composite score >= 90% of the maximum possible score (i.e., score >= 90 with default weights).

### Legacy Implementation: View-Based Ranking

The original `ViewBasedRankingProvider` is still available for backwards compatibility:

- Counts profile views in a rolling 30-day window
- Top 10% of viewed profiles = Top Talent
- Minimum 5 views required for Top Talent status

### Switching Providers

```typescript
import { setRankingProvider, ViewBasedRankingProvider, CompositeRankingProvider } from '@/lib/ranking';

// Use legacy view-based ranking
setRankingProvider(new ViewBasedRankingProvider());

// Use composite v1.1 ranking (default)
setRankingProvider(new CompositeRankingProvider());
```

### Configuration

```typescript
// Base criteria (backwards compatible)
interface RankingCriteria {
  timeWindowDays?: number;     // Default: 30
  topTalentThreshold?: number; // Default: 0.1 (top 10%)
  minViews?: number;           // Default: 5
}

// Extended v1.1 criteria
interface V11RankingCriteria extends RankingCriteria {
  weights?: Partial<ScoringWeights>;
  viewCapForMaxScore?: number;     // Default: 15
  interestCapForMaxScore?: number; // Default: 10
}

interface ScoringWeights {
  profileCompleteness: number;  // Default: 25
  uniqueViews: number;          // Default: 30
  interestRate: number;         // Default: 25
  recency: number;              // Default: 20
}
```

### Stable Types for API Consumers

The following types are exported for UI/API consumers:

```typescript
// From @/lib/ranking
export type { RankedWorkerProfile, RankingCriteria, RankingProvider };
export type { V11RankingCriteria, ScoreComponents };
export { DEFAULT_SCORING_WEIGHTS, DEFAULT_V11_CRITERIA };
```

---

## Contact Visibility Rules

### Fields Protected

- `lineId` - LINE messenger ID
- `whatsappNumber` - WhatsApp phone number
- `phoneNumber` - Direct phone number

### Profile Text Filtering

Free-text profile fields are protected against contact information leakage to enforce the Top Talent paywall. The text filter (`src/lib/helpers/text-filter.ts`) blocks:

- Phone numbers (international and Thai formats, including obfuscated patterns)
- LINE IDs and links (line.me, LINE ID mentions)
- WhatsApp contacts (wa.me links, WhatsApp number mentions)
- Telegram contacts (t.me links)
- URLs (http/https/www)
- Social media handles (@username patterns)
- Platform URLs (Instagram, Facebook, TikTok, etc.)
- Email addresses

**Protected fields** (validated on create/update, rejects with error):
- `displayName` - Worker display name
- `bio` - Worker bio text
- `experience` - Work experience description
- `location` - Location text
- `area` - Area/neighborhood text

**API**: The helper exports `validateProfileText(text)` for rejection with typed reason, `containsBlockedContact(text)` for boolean check, and `sanitizeProfileText(text)` for stripping matches.

### Visibility Logic

| Condition | Can View Contact |
|-----------|------------------|
| Viewer is the worker themselves | ✅ Yes |
| Viewer has active Top Talent subscription | ✅ Yes |
| Worker is Top Talent AND viewer has no subscription | ❌ No (locked) |
| Worker is NOT Top Talent | ✅ Yes |

### Implementation

```typescript
// Check in API/page
const canViewContact = 
  viewerId === profile.userId || // Own profile
  (await hasTopTalentAccess(viewerId)) || // Has subscription
  !(await isProfileTopTalent(profileId)); // Not top talent
```

---

## Media Storage

### Location

```
src/lib/storage/s3.ts
```

### Upload Flow

1. **Client requests presigned URL**
   ```
   POST /api/media/upload
   { contentType: "image/jpeg", folder: "profiles" }
   ```

2. **Server returns presigned URL**
   ```
   { uploadUrl, key, publicUrl, expiresIn }
   ```

3. **Client uploads directly to S3**

4. **Client confirms upload**
   ```
   PUT /api/media/upload
   { key, publicUrl }
   ```

5. **Server triggers moderation & updates profile**

### Supported Types

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

### Size Limit

5MB maximum

---

## Stripe Integration

### Location

```
src/lib/stripe/index.ts
```

### Plans

| Plan | ID | Features |
|------|----|----|
| Free | `free` | Basic search, view non-Top-Talent contacts |
| Top Talent Unlock | `top_talent_unlock` | View all contact details |

### Webhook Events Handled

- `checkout.session.completed` - Activate subscription
- `customer.subscription.updated` - Update status
- `customer.subscription.deleted` - Cancel subscription
- `invoice.payment_failed` - Mark as past_due

### Stub Mode

When `STRIPE_SECRET_KEY` is not set:
- Checkout returns mock session
- Portal returns redirect URL
- Webhooks acknowledge but don't process

---

## Moderation System

### Location

```
src/lib/moderation/index.ts
```

### Pluggable Interface

```typescript
interface ModerationProvider {
  name: string;
  moderateImage(imageUrl: string): Promise<ModerationResult>;
  moderateText(text: string): Promise<ModerationResult>;
}
```

### Default Implementation

Auto-approves all content (stub for development).

### Custom Implementation

```typescript
import { setModerationProvider } from '@/lib/moderation';

class AWSRekognitionProvider implements ModerationProvider {
  // Implement AWS Rekognition moderation
}

setModerationProvider(new AWSRekognitionProvider());
```

### Webhook Integration

Configure `MODERATION_WEBHOOK_URL` to receive moderation events:

```typescript
{
  type: "image" | "text",
  resourceId: string,
  resourceType: "profile_photo" | "profile_content",
  userId: string,
  result: ModerationResult,
  timestamp: Date
}
```

---

## Profile Photo Moderation & Quarantine

### Overview

Profile photos are subject to content moderation with a quarantine system. New photos are analyzed and either auto-approved, auto-rejected, or quarantined for admin review. Recruiters only see approved photos.

### Photo Policy (James-Locked)

| Content | Action | Requires Review |
|---------|--------|-----------------|
| Nudes / sexual acts / genitals | **BAN** (auto-reject) | No |
| Violence / hate symbols / drugs | **BAN** (auto-reject) | No |
| Lingerie / swimwear | **QUARANTINE** | Yes |
| Suggestive content | **QUARANTINE** | Yes |
| Low confidence (< 70%) | **QUARANTINE** | Yes |
| Ambiguous content | **QUARANTINE** | Yes |
| Safe content (high confidence) | **APPROVE** | No |

### Limits

- **Maximum 5** profile photos per worker
- **Maximum 1** pending photo under review at a time
- Recruiters only see **approved** photos
- Previous approved photo stays visible while new one is pending

### Designer Copy (Locked)

| Context | Copy |
|---------|------|
| Helper | "Add a clear photo so venues recognise you. Face visible preferred." |
| Rules | "No nudes. Lingerie OK — we'll review before it goes live." |
| Pending | "Photo under review — your profile stays visible with your previous photo until approved." |
| Rejected | "This photo didn't meet our guidelines. Try a clear, face-forward shot without nudity." |

### Location

```
src/lib/moderation/
├── index.ts              # Main exports
├── photo-policy.ts       # Policy rules & copy
├── photo-provider.ts     # Provider adapter interface
└── photo-moderation.ts   # Business logic & DB operations
```

### Provider Adapter Interface

```typescript
interface PhotoModerationProvider {
  name: string;
  analyzeImage(imageUrl: string): Promise<PhotoAnalysisResult>;
}
```

### Available Providers

| Provider | Status | Configuration |
|----------|--------|---------------|
| `StubPhotoModerationProvider` | Built-in | Default for development/tests |
| `AWSRekognitionProvider` | Built-in | Set `AWS_REKOGNITION_ACCESS_KEY_ID` and `AWS_REKOGNITION_SECRET_ACCESS_KEY` |

### Custom Provider Implementation

```typescript
import { setPhotoModerationProvider, type PhotoModerationProvider } from '@/lib/moderation';

class CustomProvider implements PhotoModerationProvider {
  name = "custom";
  
  async analyzeImage(imageUrl: string): Promise<PhotoAnalysisResult> {
    // Your implementation
    return { categories: ["safe"], confidence: 0.95 };
  }
}

setPhotoModerationProvider(new CustomProvider());
```

### Database Schema

```sql
CREATE TABLE profile_photos (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  worker_profile_id UUID REFERENCES worker_profiles(id),
  photo_key TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  moderation_status ENUM('pending', 'approved', 'rejected'),
  moderation_reason TEXT,
  moderation_confidence INTEGER,
  moderation_categories JSONB,
  moderation_reviewed_at TIMESTAMP,
  moderation_reviewed_by TEXT,
  display_order INTEGER,
  is_current_approved BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Admin API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/photos/pending` | GET | List photos pending review |
| `/api/admin/photos/[id]/approve` | POST | Approve a quarantined photo |
| `/api/admin/photos/[id]/reject` | POST | Reject a quarantined photo |

Admin access requires email in `ADMIN_EMAILS` environment variable.

### Upload Flow

1. **Client requests presigned URL** — limit check performed
2. **Client uploads to S3**
3. **Client confirms upload** — triggers moderation:
   - Photo analyzed by provider
   - Policy applied to determine action
   - Photo stored with appropriate status
   - If approved and first photo, becomes current profile photo
4. **Admin reviews quarantined photos** (if needed)
5. **Approved photo visible to recruiters**

### Environment Variables

```env
# AWS Rekognition (optional - enables real moderation)
AWS_REKOGNITION_ACCESS_KEY_ID=""
AWS_REKOGNITION_SECRET_ACCESS_KEY=""
AWS_REKOGNITION_REGION="us-east-1"
```

---

## Interest System

### No Chat - Interest Only

The MVP uses a simple interest expression system:
- Recruiter expresses interest in worker profile
- Worker sees list of interested recruiters
- **No threaded messaging or inbox**

### Notification Stub

The `profile_interests.notifiedAt` field is prepared for future notification integration but currently unused.

---

## Hire Outcome Tracking

### Overview

Manual tracking for when workers are hired and when they start working. This is a simple status progression system for private beta.

**Dev owns the UX/wiring slice.** This foundation provides schema, server actions, and query helpers.

### Statuses

| Status | Description |
|--------|-------------|
| `interested` | Default state - recruiter has expressed interest |
| `hired` | Worker has been hired (offer accepted) |
| `started` | Worker has begun working |

### Status Transitions

Transitions are **forward-only** and sequential:

```
interested → hired → started
```

No backwards transitions or skipping steps allowed.

### Schema

The `hire_outcomes` table links 1:1 to `profile_interests`:

| Field | Description |
|-------|-------------|
| `interest_id` | Foreign key to profile_interests (unique) |
| `status` | Current hire status |
| `hired_at` | Timestamp when marked as hired |
| `started_at` | Timestamp when marked as started |
| `notes` | Optional recruiter notes |

### Authorization

Only the **recruiter who owns the interest** can update its hire outcome. Authz is checked via:

```typescript
import { canUpdateHireOutcome } from "@/lib/hire-outcomes";

const check = canUpdateHireOutcome(
  userId,
  userRole,
  interest,
  currentStatus,
  newStatus
);

if (!check.authorized) {
  // check.reason: "unauthenticated" | "wrong_role" | "not_owner" | "invalid_transition"
}
```

### Server Actions

```typescript
import { markAsHired, markAsStarted } from "@/app/recruiter/actions";

// Mark interest as hired
await markAsHired(interestId, optionalNotes);

// Mark hired interest as started
await markAsStarted(interestId, optionalNotes);
```

### Query Helpers (for Dev UX)

```typescript
import {
  getRecruiterInterestsWithOutcomes,
  getRecruiterOutcomeStats,
  getInterestsWithHiredStatus,
  getInterestsWithStartedStatus,
} from "@/lib/hire-outcomes/queries";

// Get all interests with their outcomes (filterable)
const interests = await getRecruiterInterestsWithOutcomes(userId, "hired");

// Get stats for dashboard
const stats = await getRecruiterOutcomeStats(userId);
// { total: 10, interested: 5, hired: 3, started: 2 }
```

### Not Searchable Implications

Hire outcomes are **not currently factored into search**. The `interested` / `hired` / `started` status is private to the recruiter-worker pair and does not affect:
- Worker search results
- Worker profile visibility
- Top Talent ranking

This is intentional for private beta. Future iterations may consider surfacing "in active hiring process" indicators.

### TODO: Dev UX Slice

- List view with status filter tabs (All / Interested / Hired / Started)
- Status update buttons on interest cards
- Dashboard stats widget
- Notes editing modal

---

## Environment Variables

See `.env.example` for all configuration options.

### Required for Production

- `DATABASE_URL` - PostgreSQL connection
- `AUTH_SECRET` - NextAuth secret
- `S3_*` - Storage configuration
- `STRIPE_*` - Payment processing

### Optional

- `GOOGLE_CLIENT_*` - Social login
- `MODERATION_*` - Content moderation webhooks
- `NEXT_PUBLIC_ADSENSE_*` - Ad integration

---

## Next Steps (Feature Slices)

1. **Worker Onboarding**
   - Complete profile form with validation
   - Photo upload with crop/preview
   - Profile publish flow

2. **Search Enhancement**
   - Real search implementation
   - Filter persistence
   - Pagination

3. **Subscription Flow**
   - Connect Stripe checkout
   - Portal for subscription management
   - Access checks on contact views

4. **Notification System**
   - Email notifications for interests
   - In-app notification bell
   - Push notification prep

---

## Identity Verification System

### Overview

Workers must complete identity verification before becoming searchable. The verification flow requires:
1. **ID Document**: Government-issued ID (passport, Thai ID, driver's license)
2. **Liveness Video**: Worker holds ID next to face and speaks the date + challenge code

**Product Rule**: Workers are NOT searchable until verification is approved.

### Verification Statuses

| Status | Description | Searchable |
|--------|-------------|------------|
| `unverified` | No ID submitted yet | ❌ No |
| `pending` | ID + video submitted, awaiting admin review | ❌ No |
| `verified` | Admin approved verification | ✅ Yes |
| `rejected` | Admin rejected verification | ❌ No |

### Search Gate

**Dev owns the search-gate slice.** Use the `isSearchableWorker()` helper from `@/lib/verification`:

```typescript
import { isSearchableWorker } from "@/lib/verification";

const result = isSearchableWorker(profile);
if (!result.isSearchable) {
  // Filter out of search results
  // result.reason indicates why: "not_verified" | "pending_verification" | "rejected" | "not_published"
}
```

### Verification Events (Audit Log)

The `verification_events` table is append-only and kept **permanently** for audit compliance:

| Field | Description |
|-------|-------------|
| `decision` | `pending_submitted`, `approved`, `rejected`, `revoked` |
| `actorUserId` | Admin who made the decision (or worker for submission) |
| `method` | `manual_id_review` or `system` |
| `docType` | `passport`, `thai_id`, `drivers_license`, `other` |
| `idDocumentSha256` | SHA-256 hash of ID document (preserved after file deletion) |
| `livenessVideoSha256` | SHA-256 hash of liveness video (preserved after file deletion) |
| `challengeCode` | The challenge code issued for verification |

**Important**: Events are NEVER deleted. Only the raw media files are purged.

### Media Retention Policy

- **Retention Period**: 30 days after decision (configurable via `RETENTION_DAYS`)
- **What's Deleted**: Raw ID document files and liveness videos from S3
- **What's Kept**: All `verification_events` rows with hashes, metadata, and decision history
- **Note**: Interim policy pending legal counsel review

Run retention job: `npm run job:retention`

### Admin API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/workers/pending` | GET | List workers pending verification with signed URLs |
| `/api/admin/workers/[id]/verify` | POST | Approve or reject verification |

Admin access requires email in `ADMIN_EMAILS` environment variable (comma-separated).

Admin approve/reject is blocked if:
- ID document is missing
- Liveness video is missing  
- Challenge code record is missing

### Worker Verification Flow

1. **Generate Challenge Code**: `POST /api/worker/verification/challenge`
   - Returns 6-digit code + expiry (30 minutes)
   
2. **Upload Files**: `POST /api/worker/verification/upload`
   - Type: `id_document` or `liveness_video`
   - Returns presigned S3 upload URL

3. **Submit Verification**: `POST /api/worker/verification`
   - Requires: `idDocumentKey`, `livenessVideoKey`, `docType`
   - Both files are hashed (SHA-256) and logged
   - Transitions status: `unverified` → `pending`

### TODO: Future Work

- **Photo max 5**: James locked max 5 profile photos — photo schema change deferred to moderation/media PR
- **KYC vendor integration**: Manual review only for private beta
- **Dev owns search gate UI**: This PR provides foundation; Dev implements search filter

---

## Paid Talent: Recruiter Profile & Openings

### Overview

Recruiters can complete their profile (venue name, area, blurb) and create openings to attract workers. Workers see recruiter context when viewing interests, including venue info and optional opening tags.

**Dev owns UX/wiring slice.** This foundation provides schema, server actions, and query helpers.

### Recruiter Profile Completeness

Required fields for a complete recruiter profile:
- **Organization/Venue Name** (`organizationName`) — required
- **Area** (`area`) — required  
- **Blurb** (`blurb`) — required, max 240 characters

Optional fields:
- **Logo** (`logoUrl`, `logoKey`) — optional venue logo/photo
- **Sub-area** (`subArea`) — optional district/soi
- **Contact** (`contactEmail`, `contactPhone`) — optional

### Location

```
src/lib/recruiter-profile/
├── index.ts              # Completeness helper, constants
└── actions.ts            # Server actions for profile & openings CRUD

src/lib/interests/
├── index.ts              # Exports + empty state copy
└── context.ts            # Interest context helpers for workers
```

### Server Actions (Recruiter)

| Action | Description |
|--------|-------------|
| `updateRecruiterProfile(data)` | Update profile fields (authz: owner only) |
| `createOpening(data)` | Create new opening (authz: owner only) |
| `updateOpening(data)` | Update existing opening (authz: owner only) |
| `deleteOpening(openingId)` | Delete opening (authz: owner only) |
| `publishOpening(openingId)` | Publish opening (authz: owner only) |
| `unpublishOpening(openingId)` | Unpublish opening (authz: owner only) |
| `getRecruiterOpenings()` | List all openings for current recruiter |
| `getOpening(openingId)` | Get single opening (authz: owner only) |
| `getRecruiterProfile()` | Get current recruiter's profile |

### Query Helpers (Worker-facing)

| Function | Description |
|----------|-------------|
| `getInterestContextForWorker(interestId, requestingWorkerUserId)` | Get single interest with recruiter display context (owner worker only) |
| `getInterestsForWorkerProfile(workerProfileId, requestingWorkerUserId)` | List interests with recruiter context (owner worker only) |
| `getPublishedOpeningsForRecruiter(recruiterUserId)` | Get **published** openings for a recruiter (drafts excluded) |
| `getRecruiterVenueInfo(recruiterUserId)` | Full venue info + published openings for "View venue" CTA |

### Recruiter Openings Schema

| Field | Type | Description |
|-------|------|-------------|
| `role` | text | Job role (e.g., "Bartender", "Hostess") — required |
| `area` | text | Area/location — required |
| `payMin` | integer | Minimum pay (THB/night) — optional, **visible to workers** |
| `payMax` | integer | Maximum pay (THB/night) — optional, **visible to workers** |
| `payCurrency` | text | Currency (default "THB") |
| `payPeriod` | text | Pay period (default "night") |
| `notes` | text | Additional notes — max 500 chars |
| `isPublished` | boolean | Whether opening is visible to workers |

### Interest → Opening Link

Interests can optionally link to an opening via `openingId` on create:

- `openingId` omitted/null → general interest (still supported)
- If supplied, the opening must exist, belong to the authenticated recruiter, and be **published**
- Another recruiter's opening can never be attached
- FK `ON DELETE set null`: deleting an opening leaves the interest intact with `openingId = null`

When linked and still published:
- Worker sees "Interested in you for [Role]" tag
- Pay info from the opening is visible (no paywall)

Unpublished openings never appear in worker-facing venue/interest opening data.

### Interest Context Shape (for Workers)

```typescript
interface InterestContextForWorker {
  interestId: string;
  recruiter: {
    recruiterUserId: string;
    displayName: string | null;      // User's name
    venueName: string | null;        // organizationName
    logoUrl: string | null;
    area: string | null;
    subArea: string | null;
    blurbSnippet: string | null;     // Truncated to 120 chars
  };
  opening: {
    openingId: string;
    role: string;
    area: string;
    payMin: number | null;           // Always visible (no paywall)
    payMax: number | null;
    payCurrency: string;
    payPeriod: string;
  } | null;                          // null if interest not linked to opening
  message: string | null;
  createdAt: Date;
}
```

### Empty State Copy (Designer-Locked)

| Context | Copy |
|---------|------|
| Recruiter: No openings | "No openings yet" |
| Recruiter: No openings CTA | "Add openings to start hiring" |
| Worker: No openings at venue | "No openings at this venue right now" |
| Worker: No interests | "No interest yet — keep your profile fresh" |

### Authorization Rules

1. **Profile update**: Only the recruiter who owns the profile can update it
2. **Opening CRUD**: Only the recruiter who owns the opening's profile can create/read/update/delete
3. **Interest context**: Workers can view interest context for interests sent to their profile
4. **Published openings**: Visible to all workers; unpublished openings only visible to owner

### TODO: Dev UX Slice

- Recruiter profile edit form (mobile-first)
- Openings list with create/edit/delete/publish controls
- Worker interest list with recruiter context cards
- "View openings" / "View venue" CTAs from interest
- Empty states with locked copy

### Out of Scope

- Worker → Recruiter browse/search marketplace (no directory)
- Admin UI for recruiter management
- Chat/messaging between workers and recruiters
