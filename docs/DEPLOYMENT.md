# Deployment Guide

## Prerequisites

- Node.js 18+
- npm or pnpm
- Vercel account (for webapp hosting)
- Supabase account (for database)
- GitHub account (for OAuth)

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned

### Run Initial Schema

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

Apply the schema:

```bash
# Option 1: Via Supabase Dashboard
# Copy contents of supabase/schema.sql and run in SQL Editor

# Option 2: Via CLI (if you have direct database access)
psql -h YOUR_DB_HOST -U postgres -d postgres -f supabase/schema.sql
```

### Configure GitHub OAuth

1. In Supabase Dashboard, go to Authentication > Providers
2. Enable GitHub provider
3. Create a GitHub OAuth App:
   - Go to GitHub Settings > Developer Settings > OAuth Apps
   - New OAuth App
   - Authorization callback URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

### Get API Keys

From Supabase Dashboard > Settings > API:
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - service_role key (keep secret!)

## 2. Database Migrations

### Migration Workflow

We use Supabase migrations for database changes.

**Creating a new migration:**

```bash
# Make changes to your local database, then:
supabase db diff -f migration_name

# This creates a file in supabase/migrations/
```

**Applying migrations to production:**

```bash
# Push migrations to remote database
supabase db push

# Or apply via SQL Editor in Dashboard
```

### Migration Files Location

```
supabase/
├── schema.sql           # Initial schema (run once)
└── migrations/          # Incremental changes
    ├── 20260212000001_fix_rls_policies.sql
    └── ...
```

### Best Practices

1. **Always test migrations locally first**
   ```bash
   supabase start  # Start local Supabase
   supabase db reset  # Reset and run migrations
   ```

2. **Make migrations reversible when possible**
   - Include rollback SQL as comments

3. **Never modify production data directly**
   - Always use migrations

4. **Backup before major changes**
   ```bash
   # Via Supabase Dashboard > Database > Backups
   ```

## 3. Vercel Setup

### Import Project

1. Go to [vercel.com](https://vercel.com)
2. Import from GitHub repository
3. Set root directory to `webapp`

### Configure Environment Variables

In Vercel Dashboard > Settings > Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://aicommitcontext.dev

# GitHub OAuth (optional, for device flow)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Connect Custom Domain

1. Vercel Dashboard > Settings > Domains
2. Add `aicommitcontext.dev`
3. Configure DNS at your registrar

### Deploy

```bash
# Manual deploy
cd webapp
vercel --prod

# Or push to main branch for auto-deploy
git push origin main
```

## 4. CLI Publishing

### Build and Test

```bash
npm run build
node dist/cli/index.js --version
node dist/cli/index.js --help
```

### Publish to npm

```bash
# Update version in package.json and src/cli/index.ts
npm version patch  # or minor/major

# Publish
npm publish
```

## 5. Post-Deployment Checklist

### Verify Endpoints

```bash
# Health check
curl https://aicommitcontext.dev/api/health

# Test session list
curl https://aicommitcontext.dev/api/sessions
```

### Test Full Flow

1. **Login**: Go to `/login`, authenticate with GitHub
2. **CLI Upload**:
   ```bash
   npm install -g ai-commit-context
   acc init
   acc upload
   ```
3. **View Session**: Check dashboard for uploaded session
4. **Share Link**: Verify `/s/[code]` works

### Monitor

- Check Vercel Analytics for performance
- Review Sentry for errors (if configured)
- Monitor Supabase Dashboard for database health

## 6. Rollback Procedure

### Webapp Rollback

```bash
# Via Vercel Dashboard
# Deployments > Find previous deployment > Promote to Production

# Or via CLI
vercel rollback
```

### Database Rollback

1. Restore from backup in Supabase Dashboard
2. Or apply reverse migration SQL

### CLI Rollback

```bash
# Unpublish bad version
npm unpublish ai-commit-context@X.X.X

# Publish previous version
git checkout vX.X.X
npm publish
```

## Troubleshooting

### "Missing environment variables" at startup

Verify all required vars are set in Vercel Dashboard.

### "CSRF validation failed"

Ensure `NEXT_PUBLIC_APP_URL` matches your domain exactly.

### Database connection errors

- Check Supabase project is not paused
- Verify service role key is correct
- Check RLS policies aren't blocking

### CLI upload fails

- Run `acc login` to re-authenticate
- Check `acc config show` for correct API URL
- Verify your session exists: `acc sessions`
