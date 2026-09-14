# Testing Guide

This document describes how to run tests for the Paid Talent application.

## Overview

The project uses two testing frameworks:

- **Vitest** - Unit and integration tests for business logic
- **Playwright** - End-to-end smoke tests for UI flows

## Quick Start

```bash
# Run unit tests
npm test

# Run e2e tests (starts dev server automatically)
npm run test:e2e
```

## Unit Tests (Vitest)

### Running Tests

```bash
# Run all unit tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

Unit tests cover the following business logic:

| Module | Path | Coverage |
|--------|------|----------|
| Ranking helpers | `src/lib/helpers/ranking.ts` | Top Talent thresholds, cutoff calculations, profile ranking |
| Age verification | `src/lib/helpers/age-verification.ts` | 18+ DOB verification, age calculation |
| Contact visibility | `src/lib/helpers/contact-visibility.ts` | Subscription-based contact access rules |
| Interest validation | `src/lib/helpers/interest-validation.ts` | API request validation, auth/role checks |

### Writing New Tests

Tests live alongside the code they test:

```
src/lib/helpers/
├── ranking.ts
├── age-verification.ts
├── contact-visibility.ts
├── interest-validation.ts
└── __tests__/
    ├── ranking.test.ts
    ├── age-verification.test.ts
    ├── contact-visibility.test.ts
    └── interest-validation.test.ts
```

Example test structure:

```typescript
import { describe, it, expect } from "vitest";
import { isOver18 } from "../age-verification";

describe("age-verification helpers", () => {
  describe("isOver18", () => {
    it("should return true for someone exactly 18 years old", () => {
      const dob = new Date("2006-06-15");
      const reference = new Date("2024-06-15");
      expect(isOver18(dob, reference)).toBe(true);
    });
  });
});
```

## End-to-End Tests (Playwright)

### Prerequisites

Install Playwright browsers (first time only):

```bash
npx playwright install
```

### Running E2E Tests

```bash
# Run all e2e tests (headless, auto-starts dev server)
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed
```

### E2E Test Coverage

Current smoke tests cover:

- **Landing page** - CTA buttons visible, navigation works
- **Role selection** - Worker/recruiter cards, continue button state
- **Age verification** - Form validation, 18+ check, error messages
- **Sign-in page** - OAuth buttons present
- **Complete flow** - Role-select → age-gate → sign-in navigation
- **Mobile responsiveness** - Tests on 375x667 viewport

### Skipping Dev Server

If you already have a dev server running:

```bash
# Skip auto-starting dev server
SKIP_WEB_SERVER=true npm run test:e2e
```

### Custom Base URL

For testing against staging/production:

```bash
BASE_URL=https://staging.example.com SKIP_WEB_SERVER=true npm run test:e2e
```

## Database for Testing

Unit tests mock the database by default (see `vitest.setup.ts`). They do not need Docker or PostgreSQL.

Authenticated Playwright tests require the isolated local test database:

```bash
npm run test:db:start
npm run test:db:reset
npm run test:e2e
```

Or:

```bash
npm run test:e2e:local
```

That workflow uses:

- Docker `paid-talent-test-pg` on `127.0.0.1:55441`
- `AUTH_DEV_BYPASS=true` (development/test only; impossible in production)
- deterministic seeded accounts from `npm run test:db:reset`

`DATABASE_URL` must be localhost. Remote Neon URLs skip authenticated E2E instead of mutating cloud data.

See [docs/local-database.md](local-database.md) for ports, volumes, and safety guards.

### Important Notes

- Never seed or reset Neon/staging/production from these helpers
- `npm run db:migrate` is the explicit operator path for production migrations
- Do not force Docker for unit tests

## CI Integration

### GitHub Actions (example)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Future Test Coverage

Tests to be added with upcoming feature branches:

| Feature | Test Type | Notes |
|---------|-----------|-------|
| Onboarding flow | E2E | After onboarding branch merges |
| Worker profile creation | E2E | Requires form completion |
| Search functionality | E2E | After search feature merges |
| Subscription checkout | Integration | Mock Stripe responses |
| Media upload | Integration | Mock S3 responses |

## Troubleshooting

### Vitest Issues

**Module resolution errors**

Ensure `tsconfig.json` path aliases match `vitest.config.ts`:

```typescript
// vitest.config.ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
},
```

**Mock not working**

Mocks are defined in `vitest.setup.ts`. Ensure the mock path matches your import.

### Playwright Issues

**Browsers not installed**

```bash
npx playwright install
```

**Timeout errors**

Increase timeout in `playwright.config.ts`:

```typescript
webServer: {
  timeout: 120 * 1000, // 2 minutes
},
```

**Port already in use**

Kill existing process or use `SKIP_WEB_SERVER=true`.

### Common Fixes

```bash
# Clear test cache
rm -rf node_modules/.vitest
rm -rf playwright-report

# Reinstall dependencies
rm -rf node_modules
npm install
```

## Contact

For questions about testing, reach out to the development team.
