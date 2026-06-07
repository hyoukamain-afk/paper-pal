# Local development (read this once)

## What broke (from terminal logs)

1. **It worked** — `vite dev` with the Lovable config printed `ready in 1431 ms` on port 8080.
2. **Then** `package.json` / `tsconfig.json` became **empty on disk** (size shown in Finder, but 0 bytes when read). Vite crashed on restart.
3. **Cloudflare changes made it worse** — adding `@cloudflare/vite-plugin` to dev loaded workerd for minutes and never opened port 8080.
4. **A hand-rolled Vite config made it worse** — TanStack Start needs Lovable’s plugin stack, not a minimal DIY config.
5. **Connection refused** — browser opened while no server was listening (zombie processes, hung startup, or empty config files).

## The fix (do in order)

### 1. Move off iCloud Documents (important)

```bash
mkdir -p ~/Projects
mv "/Users/dewaanshvijayvargiya/Documents/My Apps/Paper Pal" ~/Projects/paper-pal
cd ~/Projects/paper-pal
```

### 2. Use Node 22.12+ (not required but recommended)

```bash
nvm install 22.12.0
nvm use
```

### 3. Clean install

```bash
rm -rf node_modules node_modules/.vite node_modules/.vite-temp
npm install
```

### 4. One terminal, one dev server

```bash
npm run dev:reset
```

Wait until you see:

```text
VITE v7.x.x  ready in …
➜  Local:   http://localhost:8080/
```

Only then open **http://localhost:8080/** (or the exact URL Vite prints).

### 5. Do not

- Run `wrangler dev` on `src/server.ts` (TanStack virtual imports will fail).
- Add `@cloudflare/vite-plugin` to `vite.config.ts` for local dev.
- Paste multiple shell commands on one line.
- Start a second `npm run dev` while one is already running.

## Real AI (Claude + Voyage)

1. Copy env template and add keys:

```bash
cp .env.example .env
```

2. Set in `.env`:

- `ANTHROPIC_API_KEY` — Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for generation
- `VOYAGE_API_KEY` — `voyage-3-lite` embeddings (512 dimensions) for syllabus RAG

3. Restart dev server after changing `.env`.

Without these keys the app falls back to **mock AI** and **local hash embeddings** (RAG still works, but quality is dev-only).

## Cloudflare deploy

### 1. Create Cloudflare resources (one-time)

Log in: `wrangler login`

```bash
# D1 database
wrangler d1 create paperly-db
# → copy database_id into wrangler.jsonc

# KV namespace (cache, rate limits, idempotency)
wrangler kv namespace create CACHE
# → copy id into wrangler.jsonc

# R2 bucket (syllabus book files)
wrangler r2 bucket create paperly-syllabus

# Queue (async ingest jobs)
wrangler queues create paperly-ingest

# Vectorize index — must match Voyage voyage-3-lite (512 dimensions)
wrangler vectorize create paperly-syllabus --dimensions=512 --metric=cosine
```

Update `wrangler.jsonc` with the real `database_id` and KV `id` from the commands above.

### 2. Set production secrets

Never commit API keys. Use Wrangler secrets:

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put VOYAGE_API_KEY
wrangler secret put ADMIN_SECRET
```

For local Wrangler simulation you can copy `.dev.vars.example` → `.dev.vars`.

### 3. Run D1 migrations

```bash
npm run db:migrate:remote
```

### 4. Build and deploy

```bash
npm run build
wrangler deploy
```

### 5. Ingest syllabus on production

```bash
ADMIN_SECRET=your-production-secret npm run syllabus:ingest -- --url https://paperly.<your-subdomain>.workers.dev
```

### Local dev vs production storage

- **Local dev** (`npm run dev`): API uses **in-memory** storage when CF bindings are absent.
- **Production**: D1 + KV + R2 + Vectorize + Queues from `wrangler.jsonc`.
- **D1 migrations (local)**: `npm run db:migrate:local` (stop dev server first if you see `SQLITE_BUSY`).

## Syllabus catalog (admin only — no teacher uploads)

Teachers never upload files. **You (admin)** ingest NCERT PDFs once into D1 + Vectorize.

### Add an NCERT PDF

1. Drop the PDF in `data/books/` (e.g. `ncert-10-physics.pdf`).
2. Add an entry in `data/syllabus-manifest.json` with `pdfFile` (preferred) or `textFile`:

```json
{
  "id": "ncert-10-physics",
  "board": "CBSE",
  "className": "10",
  "subject": "Physics",
  "title": "NCERT Science — Physics (Class 10)",
  "publisher": "NCERT",
  "topics": ["Electricity", "Magnetic Effects of Electric Current"],
  "r2Key": "books/cbse/10/physics/ncert-10-physics.pdf",
  "pdfFile": "data/books/ncert-10-physics.pdf"
}
```

3. Ingest to production (PDF → text → chunk → Voyage embed → D1/Vectorize):

```bash
ADMIN_SECRET=your-secret npm run syllabus:ingest -- --url https://app.hyouka.in
```

Or upload a PDF directly to the API (no R2 required):

```bash
curl -X POST "https://app.hyouka.in/api/admin/syllabus/ingest" \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -F "pdf=@data/books/ncert-10-physics.pdf" \
  -F "id=ncert-10-physics" \
  -F "board=CBSE" \
  -F "className=10" \
  -F "subject=Physics" \
  -F "title=NCERT Science Physics Class 10" \
  -F 'topics=["Electricity","Magnetic Effects of Electric Current"]' \
  -F "r2Key=books/cbse/10/physics/ncert-10-physics.pdf"
```

**Note:** PDFs must be text-based (selectable text). Scanned image-only PDFs need OCR first.

Per teacher request: only the **query** is embedded; book chunks were embedded at ingest time.
