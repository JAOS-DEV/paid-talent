# Paid Talent

A platform connecting skilled workers with recruiters. Workers create profiles showcasing their skills, and recruiters search for and connect with top talent.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (mobile-first)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Auth.js (NextAuth v5)
- **Storage**: S3-compatible object storage
- **Payments**: Stripe
- **Ads**: Google AdSense (optional)

## Features

- **Role-based accounts**: Worker or Recruiter
- **Age verification**: 18+ gate enforced at signup
- **Worker profiles**: Photo, skills, experience, contact info
- **Recruiter search**: Filter by role, area, availability
- **Top Talent ranking**: View-based ranking system (pluggable)
- **Subscription unlock**: Recruiters subscribe to view Top Talent contact details
- **Interest system**: Non-chat "I'm interested" notifications

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- S3-compatible storage (AWS S3, MinIO, DigitalOcean Spaces)
- Stripe account (for subscriptions)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/paid-talent.git
   cd paid-talent
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

> **⚠️ After pulling new changes:** If the pull includes schema changes (migrations), you must run `npm run db:migrate` before starting the dev server. If migrate fails with "type already exists", run `npm run db:repair` instead. See [Local Development After Git Pull](#local-development-after-git-pull) for troubleshooting.

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your configuration:

   ```bash
   # Required
   DATABASE_URL="postgresql://user:password@localhost:5432/paid_talent"
   AUTH_SECRET="your-secret-here"  # Generate: openssl rand -base64 32
   
   # S3 Storage
   S3_REGION="us-east-1"
   S3_BUCKET_NAME="paid-talent-media"
   S3_ACCESS_KEY_ID="your-access-key"
   S3_SECRET_ACCESS_KEY="your-secret-key"
   
   # Stripe
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

4. **Set up the database**

   ```bash
   # Generate migrations
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

### Database Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Run pending migrations
npm run db:migrate

# Repair database schema desync (use when migrate fails)
npm run db:repair

# Seed database with sample data (development only)
npm run db:seed

# Open Drizzle Studio (database UI)
npm run db:studio

# Push schema directly (development only)
npm run db:push
```

### Local Development After Git Pull

After pulling changes that include schema updates (e.g., new columns, tables, or types), you must update your local database:

```bash
npm run db:migrate
npm run db:seed  # Optional: refresh sample data
```

**Common Error: "type already exists" or "column does not exist"**

If you see errors like:
- `PostgresError: type "subscription_plan" already exists`
- `PostgresError: column "verification_status" does not exist`

This means your database schema is out of sync with the migration journal. Use the repair tool:

```bash
npm run db:repair
```

The repair tool will:
1. Check your database state
2. Sync the migration journal if needed
3. Apply any missing schema changes (like verification columns)

**Nuclear Option: Full Database Reset**

If repair doesn't work or you want a fresh start:

1. **Neon (cloud):** Go to Neon Console → Your Project → Settings → Delete all data (or create a new branch)
2. **Local PostgreSQL:** Drop and recreate the database
   ```bash
   dropdb paid_talent && createdb paid_talent
   ```
3. Run fresh setup:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

### Local Development Seed Data

The `db:seed` script populates the database with sample users for local development and testing. **This script is blocked in production** (`NODE_ENV=production`).

#### Prerequisites

1. PostgreSQL running with `DATABASE_URL` configured
2. Migrations applied: `npm run db:migrate`

> **Note:** The `db:seed` and `db:migrate` scripts load environment variables in Next.js order: `.env` first, then `.env.local` (which takes precedence). You can use either file for `DATABASE_URL`.

#### Running the Seed

```bash
npm run db:seed
```

#### Seeded Accounts

**Workers (8 total):**
| Email | Location | Status |
|-------|----------|--------|
| `worker1@example.com` | Pattaya (Central) | ⭐ Top Talent |
| `worker2@example.com` | Bangkok (Sukhumvit) | ⭐ Top Talent |
| `worker3@example.com` | Pattaya (Jomtien) | ⭐ Top Talent |
| `worker4@example.com` | Bangkok (Silom) | Normal |
| `worker5@example.com` | Pattaya (Walking Street) | Normal |
| `worker6@example.com` | Bangkok (Thonglor) | Normal |
| `worker7@example.com` | Pattaya (Beach Road) | Normal |
| `worker8@example.com` | Bangkok (Asoke) | Normal |

**Recruiters (2 total):**
| Email | Subscription |
|-------|--------------|
| `recruiter-free@example.com` | 🆓 Free (no Top Talent access) |
| `recruiter-pro@example.com` | 💳 Active Top Talent Unlock |

#### Signing In as Seed Users

1. Start the dev server: `npm run dev`
2. Navigate to: http://localhost:3000/auth/signin
3. Click "Sign in with Email"
4. Enter any seed email (e.g., `worker1@example.com`)
5. You're signed in! (No password required for dev)

The Credentials provider allows email-only authentication for existing users, making local development convenient.

#### Top Talent Ranking

Top Talent workers have 15 profile views seeded (within the 30-day window), while normal workers have only 2. This ensures Top Talent workers meet the ranking criteria:
- Minimum 5 views in the time window
- Top 10% by view count among all profiles

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   ├── auth/              # Auth pages
│   ├── worker/            # Worker pages
│   └── recruiter/         # Recruiter pages
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── auth/             # Auth components
│   └── ads/              # AdSense components
├── lib/                   # Shared libraries
│   ├── auth/             # Auth.js configuration
│   ├── db/               # Drizzle ORM
│   ├── storage/          # S3 utilities
│   ├── stripe/           # Stripe integration
│   ├── ranking/          # Top Talent ranking
│   └── moderation/       # Content moderation
├── types/                 # TypeScript types
docs/
└── architecture.md        # Detailed architecture docs
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed documentation on:

- Route groups and API boundaries
- Server actions vs route handlers
- Database schema
- Top Talent ranking system
- Contact visibility rules
- Moderation hooks

## Key Design Decisions

### Auth Flow
1. Role selection (Worker/Recruiter) **before** auth
2. Age verification (18+ required, DOB stored)
3. OAuth or email sign-in
4. Profile creation based on role

### Top Talent Ranking
- Pluggable interface (`RankingProvider`)
- Default: View-based ranking (top 10% by 30-day views)
- Easy to swap for engagement-based or ML models

### Contact Visibility
- LINE, WhatsApp, phone are protected fields
- Visible to: profile owner, subscribers, or if profile is NOT top talent
- Top Talent contacts locked behind subscription

### MVP Constraints
- **No chat** - Interest expression only
- **No worker payouts** - Direct contact after unlock
- **English first** - i18n ready but not implemented

## Customization

### Custom Ranking Provider

```typescript
// src/lib/ranking/custom.ts
import { RankingProvider, setRankingProvider } from '@/lib/ranking';

class EngagementRankingProvider implements RankingProvider {
  name = 'engagement-based';
  
  async calculateScore(profileId: string): Promise<number> {
    // Your custom logic
  }
  
  async isTopTalent(profileId: string): Promise<boolean> {
    // Your custom logic
  }
  
  async getRankedProfiles(limit: number, offset: number) {
    // Your custom logic
  }
}

setRankingProvider(new EngagementRankingProvider());
```

### Custom Moderation Provider

```typescript
// src/lib/moderation/aws.ts
import { ModerationProvider, setModerationProvider } from '@/lib/moderation';

class AWSRekognitionProvider implements ModerationProvider {
  name = 'aws-rekognition';
  
  async moderateImage(imageUrl: string) {
    // AWS Rekognition integration
  }
  
  async moderateText(text: string) {
    // AWS Comprehend integration
  }
}

setModerationProvider(new AWSRekognitionProvider());
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth.js secret |
| `S3_*` | Yes | S3-compatible storage config |
| `STRIPE_*` | Yes | Stripe API keys |
| `GOOGLE_CLIENT_*` | No | Google OAuth credentials |
| `NEXT_PUBLIC_ADSENSE_*` | No | AdSense configuration |
| `MODERATION_WEBHOOK_*` | No | Moderation webhook config |

See `.env.example` for all options.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
