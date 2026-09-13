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
- **i18n foundation** - English (default) + Thai supported

## Internationalization (i18n)

The app supports multiple languages using [next-intl](https://next-intl-docs.vercel.app/). Currently configured for:
- **English** (`en`) - Default
- **Thai** (`th`)

### Using Translations

In server components:

```typescript
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("worker.dashboard");
  return <h1>{t("title")}</h1>;
}
```

In client components:

```typescript
"use client";

import { useTranslations } from "@/lib/i18n";

export default function Component() {
  const t = useTranslations("worker.dashboard");
  return <h1>{t("title")}</h1>;
}
```

### Message Files

Translations are stored in `/messages/`:
- `en.json` - English strings
- `th.json` - Thai strings

### Adding New Translation Keys

1. Add the key to both `messages/en.json` and `messages/th.json`:

```json
// messages/en.json
{
  "worker": {
    "newFeature": {
      "title": "New Feature",
      "description": "This is a new feature"
    }
  }
}
```

```json
// messages/th.json
{
  "worker": {
    "newFeature": {
      "title": "ฟีเจอร์ใหม่",
      "description": "นี่คือฟีเจอร์ใหม่"
    }
  }
}
```

2. Use in components:

```typescript
const t = useTranslations("worker.newFeature");
return <h1>{t("title")}</h1>;
```

### Adding a New Language

1. Add the locale to `src/lib/i18n/config.ts`:

```typescript
export const locales = ["en", "th", "ja"] as const;

export const localeNames: Record<Locale, string> = {
  en: "English",
  th: "ไทย",
  ja: "日本語",
};
```

2. Create `messages/ja.json` with all translated strings

3. The new locale is automatically available for routing

### Locale Switching

Use the `useLocale` hook for client-side locale switching:

```typescript
"use client";

import { useLocale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, locales, localeNames, switchLocale } = useLocale();
  
  return (
    <select value={locale} onChange={(e) => switchLocale(e.target.value as Locale)}>
      {locales.map((l) => (
        <option key={l} value={l}>{localeNames[l]}</option>
      ))}
    </select>
  );
}
```

### Locale Routing

The app uses `as-needed` locale prefix routing:
- `/` → Default locale (English)
- `/th/worker/dashboard` → Thai locale
- `/en/worker/dashboard` → Explicit English locale (optional)

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

## Email Authentication (Magic Links)

Paid Talent uses **magic link authentication** for secure email-based sign-in. When configured, users receive a sign-in link via email instead of using passwords. A session is only created after clicking the link, preventing account hijacking.

### How It Works

1. User enters email on sign-in page
2. System sends a sign-in link to their email
3. User clicks the link (expires in 24 hours)
4. Session is created and user is signed in

**User sees:** After submitting their email, users are redirected to `/auth/verify-request` which displays "Check your email" instructions.

### Setting Up Email (Resend Recommended)

[Resend](https://resend.com) is the recommended email provider for Next.js apps. It's easy to set up and has a generous free tier.

#### 1. Create a Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (or use Resend's test domain for development)
3. Create an API key in the dashboard

#### 2. Configure Environment Variables

Add these to your `.env.local`:

```bash
# Resend SMTP Configuration
EMAIL_SERVER="smtp://resend:re_YOUR_API_KEY@smtp.resend.com:465"
EMAIL_FROM="Paid Talent <noreply@yourdomain.com>"
```

**Format breakdown:**
- `smtp://` - Protocol
- `resend` - SMTP username (always "resend" for Resend)
- `re_YOUR_API_KEY` - Your Resend API key (starts with `re_`)
- `@smtp.resend.com:465` - Resend SMTP server and port

#### Alternative Email Providers

```bash
# Gmail (requires App Password)
EMAIL_SERVER="smtp://your.email@gmail.com:your-app-password@smtp.gmail.com:587"
EMAIL_FROM="Paid Talent <your.email@gmail.com>"

# SendGrid
EMAIL_SERVER="smtp://apikey:SG.xxxxx@smtp.sendgrid.net:587"
EMAIL_FROM="Paid Talent <noreply@yourdomain.com>"

# Mailgun
EMAIL_SERVER="smtp://postmaster@yourdomain.com:your-password@smtp.mailgun.org:587"
EMAIL_FROM="Paid Talent <noreply@yourdomain.com>"
```

### Development Mode (No Email Required)

For local development with seeded test accounts, you can bypass email verification entirely. This is **insecure** and should **never** be enabled in production.

#### Enable Dev Bypass

Add to `.env.local`:

```bash
AUTH_DEV_BYPASS="true"
```

**Requirements:**
- `NODE_ENV` must be `development` (default for `npm run dev`)
- `AUTH_DEV_BYPASS` must be explicitly set to `"true"`

When enabled:
- Sign-in page shows "Dev Bypass" option
- Enter any seeded email (e.g., `worker1@example.com`)
- Instant sign-in without email verification

#### Security Warning

> **DANGER:** Never enable `AUTH_DEV_BYPASS` in production, staging, or any internet-accessible environment. This bypass allows anyone who knows a registered email address to hijack that account.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Email provider not configured" | Set `EMAIL_SERVER` and `EMAIL_FROM` in `.env.local` |
| Emails not arriving | Check spam folder; verify domain with email provider |
| "Invalid credentials" | Verify API key format and SMTP server details |
| Link expired | Links expire after 24 hours; request a new one |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth.js secret |
| `EMAIL_SERVER` | Prod | SMTP connection URL for magic links |
| `EMAIL_FROM` | Prod | "From" address for sign-in emails |
| `AUTH_DEV_BYPASS` | No | Set to `"true"` for local dev only |
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
