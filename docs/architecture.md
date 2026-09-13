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

### Default Implementation: View-Based Ranking

- Counts profile views in a rolling 30-day window
- Top 10% of viewed profiles = Top Talent
- Minimum 5 views required for Top Talent status

### Customization

```typescript
import { setRankingProvider } from '@/lib/ranking';

// Implement custom ranking
class CustomRankingProvider implements RankingProvider {
  // ...
}

setRankingProvider(new CustomRankingProvider());
```

### Configuration

```typescript
interface RankingCriteria {
  timeWindowDays?: number;     // Default: 30
  topTalentThreshold?: number; // Default: 0.1 (top 10%)
  minViews?: number;           // Default: 5
}
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

## Interest System

### No Chat - Interest Only

The MVP uses a simple interest expression system:
- Recruiter expresses interest in worker profile
- Worker sees list of interested recruiters
- **No threaded messaging or inbox**

### Notification Stub

The `profile_interests.notifiedAt` field is prepared for future notification integration but currently unused.

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
