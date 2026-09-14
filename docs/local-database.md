# Local development database

Paid Talent uses Docker PostgreSQL for everyday local work and automated tests. Production on Vercel continues to use the Neon `DATABASE_URL` supplied by Vercel environment variables.

This is database infrastructure only. The Next.js app is not containerized.

## What Docker Desktop is doing

Compose project name: `paid-talent`

| Service | Container | Port | Database | Volume | Purpose |
| --- | --- | --- | --- | --- | --- |
| `paid-talent-dev-pg` | `paid-talent-dev-pg` | `127.0.0.1:55440` | `paid_talent_dev` | `paid-talent-dev-pg-data` | Persistent everyday development |
| `paid-talent-test-pg` | `paid-talent-test-pg` | `127.0.0.1:55441` | `paid_talent_test` | `paid-talent-test-pg-data` | Isolated resettable tests / E2E |

Both ports bind to localhost only. Defaults avoid `5432`, VenuBoard (`5432x` / `5532x`), and the temporary `paid-talent-pr30-pg` mapping on `55432`.

Postgres image: `postgres:16-alpine`. Production Neon was not queried. Postgres 16 is a Neon-supported major version and matches the existing isolated local validation container (`paid-talent-pr30-pg`, PostgreSQL 16.15). The tag is pinned; `latest` is not used.

If Docker Desktop is stopped, local DB commands will fail until Docker is started.

## Local vs production

| Environment | Database | How `DATABASE_URL` is set |
| --- | --- | --- |
| Local `npm run dev` | Docker `paid-talent-dev-pg` | `.env.local` (gitignored) |
| Local Playwright authenticated E2E | Docker `paid-talent-test-pg` | injected by `npm run test:e2e:local` |
| Vercel production | Neon | Vercel project environment |

`.env.local` is local-only and must never be committed. Never copy a production Neon URL into git.

### `.env.local` pattern

```bash
DATABASE_URL="postgresql://paidtalent:paidtalent@127.0.0.1:55440/paid_talent_dev"
AUTH_DEV_BYPASS="true"
```

Test URL (used by `npm run test:db:*`, not everyday `npm run dev`):

```bash
postgresql://paidtalent:paidtalent@127.0.0.1:55441/paid_talent_test
```

The Docker username/password above are local-only defaults, not production secrets.

## One-command local startup

```bash
npm install
npm run dev:db:start
npm run dev:db:migrate
npm run dev:db:seed
npm run dev
```

`npm run dev` does not seed or reset the database. Persistent local data is kept on purpose.

## Commands

### Development DB

```bash
npm run dev:db:start      # start and wait until healthy
npm run dev:db:stop       # stop container; named volume is kept
npm run dev:db:status
npm run dev:db:logs
npm run dev:db:migrate    # always targets local paid_talent_dev
npm run dev:db:seed       # local-only; refuses remote hosts
npm run dev:db:reset      # DESTRUCTIVE: reset paid_talent_dev only
```

`dev:db:stop` is not destructive. Use `dev:db:reset` only when you want a clean local dev database.

### Test DB

```bash
npm run test:db:start
npm run test:db:stop
npm run test:db:reset     # DESTRUCTIVE: reset paid_talent_test, migrate, seed
npm run test:db:migrate
npm run test:db:seed
npm run test:db:integration
```

`test:db:reset` never touches the dev DB, Neon, staging, or production.

### Generic migrate (production operator action)

```bash
npm run db:migrate
```

This uses whatever `DATABASE_URL` is in the environment. It is the intentional production/staging migration path. Automated tests must not invoke it against a remote database. Local helpers (`dev:db:migrate` / `test:db:migrate`) always force the matching localhost URL first.

`npm run db:seed` and `npm run db:repair` refuse remote, malformed, missing, or ambiguous URLs.

## Why remote DB safety guards exist

Local `.env.local` can accidentally still contain a Neon `DATABASE_URL`. Seed, repair, test reset, and other destructive helpers parse `DATABASE_URL` and refuse anything that is not `localhost` / `127.0.0.1` / `::1`. Errors never print passwords or full connection strings.

## Playwright / local auth

Authenticated E2E stays skipped unless:

- `DATABASE_URL` is localhost
- `AUTH_DEV_BYPASS=true`
- the test DB has been migrated and seeded

`AUTH_DEV_BYPASS` remains development-only. Production auth is unchanged.

```bash
npm run test:db:start
npm run test:db:reset
npm run test:e2e
```

Equivalent one-shot (starts test DB, resets it, injects local URL + bypass, runs Playwright):

```bash
npm run test:e2e:local
```

Unit tests (`npm test`) do not require Docker or PostgreSQL.

## PR-specific disposable databases

Normal feature work uses `paid-talent-dev-pg`. Resettable E2E uses `paid-talent-test-pg`.

For a migration-heavy branch, create an isolated PR database that never shares the dev/test volumes:

```bash
npm run pr:db:start -- --pr 42
```

Default container/volume/port:

- container: `paid-talent-pr42-pg`
- volume: `paid-talent-pr42-pg-data`
- database: `paid_talent_pr_42`
- port: `127.0.0.1:55542` (`55500 + PR number`, override with `--port`)

Then point a throwaway env at:

```bash
DATABASE_URL="postgresql://paidtalent:paidtalent@127.0.0.1:55542/paid_talent_pr_42"
```

```bash
npm run pr:db:stop -- --pr 42
```

Stop does not delete the volume. Remove the container/volume manually when the PR is finished. Do not reuse `paid-talent-dev-pg` or `paid-talent-test-pg` volumes for PR experiments.

## Troubleshooting

| Issue | What to do |
| --- | --- |
| `Docker is not available` | Start Docker Desktop, wait until it is running, retry |
| Port already allocated | Set `PAID_TALENT_DEV_DB_PORT` / `PAID_TALENT_TEST_DB_PORT` and matching `DATABASE_URL` |
| `Refusing to ... because DATABASE_URL is not local` | Point `.env.local` at `127.0.0.1:55440` or use `npm run dev:db:*` / `npm run test:db:*` |
| Authenticated Playwright skipped | Run `npm run test:e2e:local` (or local URL + `AUTH_DEV_BYPASS=true` + seed) |
| Schema desync on local DB | `npm run db:repair` against localhost, or `npm run dev:db:reset` |
| Old `paid-talent-pr30-pg` still running | Leave it until the permanent Compose DBs are proven; then stop/remove it manually |

Do not delete VenuBoard Docker resources. Do not expose Postgres beyond localhost.
