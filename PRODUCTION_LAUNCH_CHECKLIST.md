# Production Launch Checklist - AI Commit Context

## Prezentare Generala

**Aplicatie**: AI Commit Context (ACC) - Platforma care conecteaza conversatiile Claude Code la commits si pull requests GitHub.

**Stack Tehnologic**:
- Frontend: Next.js 14.1.0 (React 18.2) cu TypeScript
- Backend: Express.js API server
- Database: Supabase PostgreSQL
- Auth: GitHub OAuth via Supabase
- CLI Tool: Node.js/TypeScript (`@ai-commit-context/cli`)

---

## ARHITECTURA FULL STACK (SIMPLIFICATA - TOTUL PE VERCEL)

```
┌─────────────────────────────────────────────────────────────────┐
│                         UTILIZATORI                              │
└─────────────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│   CLI Tool (acc)    │              │      Browser        │
│   npm package       │              │                     │
└─────────────────────┘              └─────────────────────┘
            │                                    │
            └────────────────┬───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js App (Vercel) - TOTUL AICI                   │
│              aicommitcontext.dev                                 │
│                                                                  │
│   ┌─────────────────┐    ┌─────────────────────────────────┐    │
│   │   Frontend      │    │   API Routes (inlocuieste       │    │
│   │   (React)       │    │   Express server)               │    │
│   │                 │    │                                 │    │
│   │   - Dashboard   │    │   /api/health                   │    │
│   │   - Login       │    │   /api/sessions (POST/GET)      │    │
│   │   - Viewer      │    │   /api/sessions/[code]          │    │
│   │                 │    │   /api/sessions/[code]/commits  │    │
│   │                 │    │   /api/commits/[sha]/context    │    │
│   └─────────────────┘    └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                         │
│                    Auth + Database                               │
└─────────────────────────────────────────────────────────────────┘
```

### AVANTAJE (fata de Express separat):
- **Un singur deploy** pe Vercel
- **Un singur domeniu** - fara api.xxx subdomain
- **Zero cost extra** - Vercel free tier include API routes
- **Simplitate** - mai putin de configurat si mentinut

### Cele 2 Componente (in loc de 3):

| Componenta | Folder | Deploy | Functie |
|------------|--------|--------|---------|
| **Webapp + API** | `webapp/` | Vercel | UI + API routes (inlocuieste Express) |
| **CLI Tool** | `src/` (root) | npm registry | Scanneaza conversatii, uploadeaza pe Vercel |

### API Routes de migrat din Express in Next.js:

| Express Endpoint | Next.js API Route | Status |
|------------------|-------------------|--------|
| `GET /api/health` | `app/api/health/route.ts` | DE CREAT |
| `POST /api/sessions` | `app/api/sessions/route.ts` | DE CREAT |
| `GET /api/sessions` | `app/api/sessions/route.ts` | DE CREAT |
| `GET /api/sessions/:code` | `app/api/sessions/[code]/route.ts` | DE CREAT |
| `POST /api/sessions/:code/commits` | `app/api/sessions/[code]/commits/route.ts` | DE CREAT |
| `GET /api/commits/:sha/context` | `app/api/commits/[sha]/context/route.ts` | DE CREAT |

---

## PROBLEME CRITICE DE REZOLVAT INAINTE DE LANSARE

### 1. URGENT: Sterge Codul de Debug/Telemetrie

**Fisiere afectate si liniile exacte:**

| Fisier | Linii de sters |
|--------|----------------|
| `webapp/middleware.ts` | Linia 6, Linia 51 |
| `webapp/app/dashboard/page.tsx` | Liniile 58, 72, 80, 88, 95, 102, 107, 114, 126, 149 |
| `webapp/app/not-found.tsx` | Linia 9 |
| `webapp/app/docs/getting-started/page.tsx` | Linia 12 |

**Pattern de cautat si sters:**
```typescript
fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',...).catch(()=>{});
```

**Total: 14 linii de cod de debug care trebuie sterse!**

**Risc**: Datele utilizatorilor (session IDs, user info, paths) sunt trimise la un endpoint local care nu ar trebui sa existe in productie.

---

### 2. Dezactivare Sistem de Plati (Stripe)

Pentru lansare FARA plati, trebuie:

#### A. Fisiere Stripe care necesita modificare:

| Fisier | Actiune |
|--------|---------|
| `webapp/lib/stripe.ts` | Modifica pentru a returna "Pro" pentru toti |
| `webapp/app/api/stripe/create-checkout/route.ts` | Returneaza eroare "Coming soon" |
| `webapp/app/api/stripe/create-portal/route.ts` | Returneaza eroare "Coming soon" |
| `webapp/app/api/stripe/webhook/route.ts` | Poate fi lasat (nu va fi apelat) |

#### B. Modifica `webapp/app/api/stripe/create-checkout/route.ts`:
```typescript
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Payments coming soon!' },
    { status: 503 }
  )
}
```

#### C. Modifica `webapp/app/api/stripe/create-portal/route.ts`:
```typescript
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Billing portal coming soon!' },
    { status: 503 }
  )
}
```

#### D. Modifica `webapp/app/dashboard/page.tsx`:
- Ascunde/modifica SubscriptionCard
- Seteaza toti utilizatorii cu acces "Pro" sau "unlimited"

#### E. Modifica `webapp/app/pricing/page.tsx`:
- Afiseaza mesaj "Coming soon" pentru planurile platite
- Sau redirect la dashboard pentru utilizatorii logati

#### F. NU seta variabilele de mediu Stripe in productie:
- `STRIPE_SECRET_KEY` - Nu seta
- `STRIPE_WEBHOOK_SECRET` - Nu seta
- `STRIPE_PRO_PRICE_ID` - Nu seta
- `STRIPE_TEAM_PRICE_ID` - Nu seta

---

### 3. Securitate - Politici RLS

**Problema**: Tabelele `commits` si `session_commits` permit inserari de la oricine.

**Actiune**: Actualizeaza `supabase/schema.sql` pentru a restrictiona:
```sql
-- Modifica politica pentru commits
CREATE POLICY "Only authenticated users can insert commits"
  ON commits FOR INSERT TO authenticated
  WITH CHECK (true);

-- Modifica politica pentru session_commits
CREATE POLICY "Only session owners can link commits"
  ON session_commits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_commits.session_id
      AND sessions.user_id = auth.uid()
    )
  );
```

---

## VARIABILE DE MEDIU NECESARE

### Webapp (Vercel/Production) - OBLIGATORII pentru lansare

```env
# Supabase (OBLIGATORIU)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your_service_role_key

# App URL (OBLIGATORIU - fara slash la final!)
NEXT_PUBLIC_APP_URL=https://aicommitcontext.dev
```

### Variabile Stripe - NU SETA pentru lansare fara plati
```env
# NU SETA ACESTE VARIABILE IN PRODUCTIE DACA NU FOLOSESTI STRIPE
# STRIPE_SECRET_KEY=sk_live_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
# STRIPE_PRO_PRICE_ID=price_xxx
# STRIPE_TEAM_PRICE_ID=price_xxx
```

### Server API Separat - NU MAI E NECESAR!

~~Daca folosesti server separat pentru CLI~~ **IGNORAT** - API-ul este acum in Next.js.

Toate API routes sunt acum la: `https://aicommitcontext.dev/api/...`

### Unde gasesti cheile Supabase:
1. Mergi la https://supabase.com/dashboard
2. Selecteaza proiectul tau
3. Settings > API
4. Copiaza: Project URL, anon key, service_role key

---

## CONFIGURARE CLI

CLI-ul are URL-ul API hardcodat in `src/types.ts:102`.

### IMPORTANT: Schimba URL-ul inainte de publicare pe npm

Editeaza `src/types.ts` linia 102:
```typescript
// INAINTE (api subdomain - nu mai e necesar)
apiUrl: 'https://api.aicommitcontext.dev',

// DUPA (direct pe domeniul principal)
apiUrl: 'https://aicommitcontext.dev/api',
```

De asemenea, editeaza `src/upload/index.ts` liniile 19 si 123:
```typescript
// Schimba fallback-ul
const apiUrl = config.auth.apiUrl || 'https://aicommitcontext.dev/api';
```

### Config file pentru CLI
CLI-ul citeste configuratia din `~/.acc/config.json`:
```json
{
  "auth": {
    "apiUrl": "https://aicommitcontext.dev/api",
    "token": "user-token-here"
  }
}
```

---

## PASI DE DEPLOYMENT

### Pasul 1: Pregatire Codebase

- [ ] Sterge codul de debug telemetrie (127.0.0.1:7242)
- [ ] Dezactiveaza/modifica rutele Stripe
- [ ] Modifica UI-ul pentru a nu afisa optiuni de plata
- [ ] Seteaza toti userii cu acces "unlimited" sau "Pro"
- [ ] Actualizeaza politicile RLS in Supabase

### Pasul 2: Configurare Supabase

- [ ] Creeaza proiect nou in Supabase (sau foloseste existent)
- [ ] Ruleaza `supabase/schema.sql` pentru tabele principale
- [ ] Ruleaza `supabase/schema_subscriptions.sql` (optional, pentru viitor)
- [ ] Configureaza GitHub OAuth Provider:
  1. Mergi la Authentication > Providers > GitHub
  2. Activeaza GitHub provider
  3. Adauga Client ID si Client Secret de la GitHub OAuth App
  4. Seteaza Redirect URL: `https://your-domain.com/auth/callback`
- [ ] Verifica politicile RLS sunt active pe toate tabelele

### Pasul 3: Configurare GitHub OAuth App

1. Mergi la GitHub Settings > Developer Settings > OAuth Apps
2. Creeaza New OAuth App:
   - Application name: AI Commit Context
   - Homepage URL: https://your-domain.com
   - Authorization callback URL: https://your-domain.com/auth/callback
3. Noteaza Client ID si Client Secret
4. Adauga-le in Supabase Auth settings

### Pasul 4: Deploy Webapp pe Vercel

- [ ] Conecteaza repo-ul la Vercel
- [ ] Seteaza Root Directory: `webapp` (daca e monorepo)
- [ ] Adauga variabilele de mediu in Vercel Dashboard
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `.next`
- [ ] Deploy

### Pasul 5: Migrare API in Next.js (NU MAI E NEVOIE DE SERVER SEPARAT!)

Next.js are API routes built-in. Totul ruleaza pe Vercel, un singur deploy!

#### 5.1 Creeaza structura API routes in webapp:

```
webapp/app/api/
├── health/
│   └── route.ts          # GET /api/health
├── sessions/
│   ├── route.ts          # GET, POST /api/sessions
│   └── [code]/
│       ├── route.ts      # GET /api/sessions/:code
│       └── commits/
│           └── route.ts  # POST /api/sessions/:code/commits
└── commits/
    └── [sha]/
        └── context/
            └── route.ts  # GET /api/commits/:sha/context
```

#### 5.2 Instaleaza nanoid in webapp:
```bash
cd webapp
npm install nanoid
```

#### 5.3 Creeaza `webapp/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '0.1.0',
    database: 'supabase'
  })
}
```

#### 5.4 Creeaza `webapp/app/api/sessions/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// POST - Upload session (de la CLI)
export async function POST(request: NextRequest) {
  try {
    const { sessionId, projectName, startedAt, endedAt, messages, filesModified } =
      await request.json()

    if (!sessionId || !messages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const shortCode = nanoid(8)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        short_code: shortCode,
        project_name: projectName || 'Unknown Project',
        started_at: startedAt || new Date().toISOString(),
        ended_at: endedAt || null,
        message_count: messages.length,
        messages: messages,
        files_modified: filesModified || [],
        privacy: 'unlisted'
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    return NextResponse.json({
      success: true,
      id: data.id,
      shortCode: data.short_code,
      url: `${baseUrl}/s/${data.short_code}`
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET - List sessions
export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('sessions')
    .select('id, short_code, project_name, message_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    sessions: data?.map(s => ({
      id: s.id,
      shortCode: s.short_code,
      projectName: s.project_name,
      messageCount: s.message_count,
      uploadedAt: s.created_at
    })) || []
  })
}
```

#### 5.5 Testeaza local:
```bash
cd webapp
npm run dev
curl http://localhost:3000/api/health
# Trebuie sa returneze: {"status":"ok","version":"0.1.0","database":"supabase"}
```

---

### Pasul 6: Publicare CLI pe npm

CLI-ul permite utilizatorilor sa uploadeze conversatii Claude Code.

#### 6.1 Pregatire pentru publicare:

```bash
# Din root folder (nu webapp/ sau server/)
cd C:\Users\comsa\ai-commit-context

# 1. Verifica package.json
# name: "@ai-commit-context/cli"
# version: "0.1.0"

# 2. Build
npm run build

# 3. Test local
npm link
acc --help
```

#### 6.2 Configureaza npm account:

```bash
# Login pe npm (creeaza cont daca nu ai)
npm login

# Verifica esti logat
npm whoami
```

#### 6.3 Publica pachetul:

```bash
# Pentru scoped package (@ai-commit-context/cli) trebuie public access
npm publish --access public
```

#### 6.4 Dupa publicare, utilizatorii pot instala cu:

```bash
npm install -g @ai-commit-context/cli

# Sau
npx @ai-commit-context/cli --help
```

#### 6.5 Actualizeaza versiunea pentru release-uri noi:

```bash
# Patch (0.1.0 -> 0.1.1)
npm version patch

# Minor (0.1.0 -> 0.2.0)
npm version minor

# Major (0.1.0 -> 1.0.0)
npm version major

# Apoi publica
npm publish --access public
```

---

### Pasul 7: Configurare GitHub Action (OPTIONAL)

GitHub Action-ul adauga automat context AI la Pull Requests.

#### 7.1 Actualizeaza URL-ul API in `github-action/action.yml`:
```yaml
# Schimba default de la api.aicommitcontext.dev la:
default: 'https://aicommitcontext.dev/api'
```

#### 7.2 Pentru a-l folosi, utilizatorii adauga in repo-ul lor:

`.github/workflows/ai-context.yml`:
```yaml
name: AI Commit Context
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  annotate:
    runs-on: ubuntu-latest
    steps:
      - uses: your-username/ai-commit-context@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          api-url: https://aicommitcontext.dev/api
```

#### 7.3 Publica GitHub Action:
- Action-ul este deja in repo
- Utilizatorii il pot folosi direct cu `uses: your-username/ai-commit-context@main`
- Pentru Marketplace, mergi la repo > Releases > Draft a release > Publish to Marketplace

---

### Pasul 8: Configurare DNS (SIMPLIFICAT)

- [ ] Configureaza domeniul principal pentru Vercel (aicommitcontext.dev)
- [ ] ~~Configureaza subdomeniu pentru API~~ **NU MAI E NECESAR**
- [ ] Verifica SSL certificate este activ

**Nota**: Un singur domeniu pentru tot (webapp + API)!

### Pasul 9: Testare Pre-Launch

#### Testare API (pe Vercel):
```bash
# Health check
curl https://aicommitcontext.dev/api/health
# Trebuie sa returneze: {"status":"ok","version":"0.1.0","database":"supabase"}

# List sessions
curl https://aicommitcontext.dev/api/sessions
```

#### Testare Webapp:
- [ ] Test login cu GitHub OAuth
- [ ] Test dashboard loading
- [ ] Test vizualizare sesiune existenta
- [ ] Test share session (short code `/s/[code]`)
- [ ] Verifica ca nu apar erori in browser console
- [ ] Verifica ca debug endpoints nu mai sunt apelate

#### Testare CLI:
```bash
# Instaleaza global
npm install -g @ai-commit-context/cli

# Verifica help
acc --help

# Testeaza list sessions (daca ai conversatii Claude locale)
acc list

# Testeaza upload (catre Vercel)
acc upload --server https://aicommitcontext.dev/api
```

#### Testare End-to-End:
- [ ] CLI uploadeaza o sesiune -> apare in dashboard
- [ ] Short code functioneaza pentru share (`/s/[code]`)
- [ ] Linkul din PR duce la sesiunea corecta

---

## MODIFICARI DE COD RECOMANDATE

### 1. Dezactivare Stripe - Quick Fix

Creeaza fisier `lib/stripe-disabled.ts`:
```typescript
// Temporary disabled for launch without payments
export const STRIPE_ENABLED = false;

export function isProUser(userId: string): boolean {
  // Everyone is Pro for now
  return true;
}

export function getSessionLimit(userId: string): number {
  // Unlimited sessions
  return Infinity;
}

export function getRepoLimit(userId: string): number {
  // Unlimited repos
  return Infinity;
}
```

### 2. Modifica Middleware pentru a nu verifica subscription

In `middleware.ts`, comenteaza sau sterge verificarile de subscription.

### 3. Modifica Dashboard

In `app/dashboard/page.tsx`:
- Sterge sau ascunde `SubscriptionCard`
- Afiseaza "Pro" ca plan curent pentru toti utilizatorii

---

## LISTA DE VERIFICARE FINALA

### Inainte de Launch

- [ ] Toate variabilele de mediu sunt setate corect
- [ ] GitHub OAuth functioneaza
- [ ] Database schema este aplicat
- [ ] RLS policies sunt active
- [ ] Debug code este sters
- [ ] Stripe routes sunt dezactivate/modificate
- [ ] Toate paginile se incarca fara erori
- [ ] Mobile responsive functioneaza

### Dupa Launch

- [ ] Monitorizeaza erorile in Vercel/hosting logs
- [ ] Verifica Supabase logs pentru erori database
- [ ] Testeaza cu un utilizator real
- [ ] Seteaza alerte pentru erori

---

## FUNCTIONALITATI CARE VOR LIPSI (FARA STRIPE)

1. **Upgrade la Pro/Team** - Nu va functiona
2. **Billing Portal** - Nu va fi disponibil
3. **Limite de sesiuni** - Trebuie dezactivate sau setate pe "unlimited"
4. **Limite de repositories** - Trebuie dezactivate

---

## TIMELINE RECOMANDAT (Simplificat - Totul pe Vercel)

1. **Ziua 1**: Curatare cod (debug telemetry, Stripe routes)
2. **Ziua 2**: Creeaza API routes in Next.js (migreaza din Express)
3. **Ziua 3**: Configurare Supabase + GitHub OAuth + schema SQL
4. **Ziua 4**: Deploy pe Vercel + configurare DNS
5. **Ziua 5**: Publicare CLI pe npm + testare end-to-end
6. **Ziua 6**: Soft launch + monitoring

---

## CONTACTE SI RESURSE

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **GitHub OAuth Docs**: https://docs.github.com/en/apps/oauth-apps

---

---

## REZUMAT RAPID - TOP 6 ACTIUNI CRITICE (Full Stack pe Vercel)

1. **Sterge codul de debug** (14 linii in 4 fisiere)
   - `webapp/middleware.ts`, `webapp/app/dashboard/page.tsx`, `webapp/app/not-found.tsx`, `webapp/app/docs/getting-started/page.tsx`

2. **Dezactiveaza Stripe routes**
   - Modifica `create-checkout` si `create-portal` sa returneze "Coming soon"

3. **Creeaza API routes in Next.js** (migreaza din Express)
   - `/api/health`, `/api/sessions`, `/api/sessions/[code]`, `/api/commits/[sha]/context`

4. **Configureaza Supabase**
   - Ruleaza `supabase/schema.sql`
   - Activeaza GitHub OAuth in Authentication > Providers

5. **Deploy pe Vercel** (un singur deploy pentru tot!)
   - Seteaza: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`

6. **Publica CLI pe npm** (dupa ce schimbi URL-ul API)
   - Editeaza `src/types.ts` -> `apiUrl: 'https://aicommitcontext.dev/api'`
   - `npm publish --access public`

---

## FISIERE IMPORTANTE

| Fisier | Descriere |
|--------|-----------|
| `webapp/` | Aplicatia Next.js principala |
| `server/` | Server Express pentru CLI |
| `src/` | CLI tool (ai-commit-context) |
| `github-action/` | GitHub Action pentru PR annotation |
| `supabase/schema.sql` | Schema database principal |
| `supabase/schema_subscriptions.sql` | Schema pentru subscriptii |
| `webapp/.env.example` | Template variabile mediu webapp |
| `server/.env.example` | Template variabile mediu server |

---

## CHECKLIST FINAL (TOTUL PE VERCEL)

### Cod - Curatare
- [ ] Debug telemetry sters (14 linii cu 127.0.0.1:7242)
- [ ] Stripe routes dezactivate (create-checkout, create-portal)
- [ ] API routes create in Next.js (health, sessions, commits)

### Cod - CLI
- [ ] URL API actualizat in `src/types.ts:102` -> `https://aicommitcontext.dev/api`
- [ ] URL API actualizat in `src/upload/index.ts:19,123`
- [ ] Build successful (`npm run build`)

### Supabase
- [ ] Proiect creat
- [ ] Schema SQL rulat (`supabase/schema.sql`)
- [ ] GitHub OAuth activat
- [ ] RLS policies verificate

### Vercel (UN SINGUR DEPLOY)
- [ ] Repo conectat
- [ ] Root Directory: `webapp`
- [ ] Variabile de mediu setate:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_APP_URL`
- [ ] Domeniu configurat (aicommitcontext.dev)
- [ ] SSL activ
- [ ] Health check OK (`/api/health`)

### npm (CLI)
- [ ] Publicat pe npm (`npm publish --access public`)
- [ ] Test install global (`npm i -g @ai-commit-context/cli`)
- [ ] Test `acc --help`
- [ ] Test upload catre Vercel

### DNS (SIMPLIFICAT - un singur domeniu)
- [ ] aicommitcontext.dev -> Vercel

### Testare Finala
- [ ] `curl https://aicommitcontext.dev/api/health` returneaza OK
- [ ] Login cu GitHub functioneaza
- [ ] Dashboard se incarca
- [ ] CLI upload functioneaza
- [ ] Sesiunile apar in dashboard
- [ ] Share link `/s/[code]` functioneaza

---

## URL-URI FINALE

| Serviciu | URL |
|----------|-----|
| Webapp + API | https://aicommitcontext.dev |
| API Health | https://aicommitcontext.dev/api/health |
| API Sessions | https://aicommitcontext.dev/api/sessions |
| Supabase | https://xxx.supabase.co |
| npm package | https://www.npmjs.com/package/@ai-commit-context/cli |
| GitHub Repo | https://github.com/xxx/ai-commit-context |

---

*Document generat: 2026-02-03*
*Versiune: 2.0 (Full Stack)*
