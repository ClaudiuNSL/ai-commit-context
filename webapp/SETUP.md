# Setup webapp – pași obligatorii

## 1. Rulezi din folderul corect

Trebuie să rulezi aplicația din folderul **webapp**:

```bash
cd webapp
npm install
npm run dev
```

Deschide în browser: **http://localhost:3000**

Dacă ai mai multe copii ale proiectului (de ex. worktree), asigură-te că modificările le faci în folderul din care rulezi `npm run dev`.

---

## 2. Variabile de mediu (obligatoriu pentru login)

În folderul **webapp** creează fișierul **`.env.local`** (copiază din `.env.example` și completează):

```env
# OBLIGATORIU pentru login cu GitHub
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Recomandat (pentru redirect-uri)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Unde le găsești:
- Supabase Dashboard → Project Settings → API → **Project URL** și **anon public** key.

Fără aceste două variabile, login-ul **nu** poate funcționa.

---

## 3. Supabase – URL-uri pentru GitHub login

În Supabase: **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** adaugă `http://localhost:3000/auth/callback`

În **Authentication → Providers** activează **GitHub** și completează Client ID și Secret de la GitHub OAuth App.

---

## 4. După ce modifici .env.local

Oprește serverul (Ctrl+C), pornește din nou:

```bash
cd webapp
npm run dev
```

Dacă ceva nu merge, verifică în browser (F12 → Console) ce erori apar.
