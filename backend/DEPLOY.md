# BizdenBize — Backend Setup & Deployment Guide
# Follow these steps in order. Takes ~2 hours total.

═══════════════════════════════════════════════════
STEP 1 — SUPABASE SETUP (~20 min)
═══════════════════════════════════════════════════

1. Go to https://supabase.com → Sign up with GitHub
2. Click "New Project"
   - Name: bizdenbize
   - Password: generate strong password → SAVE IT
   - Region: Frankfurt (eu-central-1) ← IMPORTANT for GDPR
3. Wait ~2 minutes for provisioning

4. Run the database schema:
   - Go to SQL Editor → New Query
   - Paste entire contents of: backend/schema.sql
   - Click "Run" → should say "Success"

5. Get your API keys:
   - Settings → API
   - Copy: Project URL, anon key, service_role key
   - Save these — you'll need them in Step 3 and 4

6. Configure Auth:
   - Authentication → Settings
   - Site URL: https://bizdenbize.com
   - Add redirect URL: https://bizdenbize.com/mahallem.html
   - Enable: Email confirmations → OFF (for now, faster onboarding)
   - Enable: "Confirm email" → OFF

═══════════════════════════════════════════════════
STEP 2 — DEPLOY EDGE FUNCTIONS (~20 min)
═══════════════════════════════════════════════════

Install Supabase CLI:
  npm install -g supabase

Login:
  supabase login

Link project (get project ref from Supabase URL):
  supabase link --project-ref YOUR_PROJECT_REF

Set secrets (replace with real values):
  supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
  supabase secrets set RESEND_API_KEY=re_your_key

Deploy functions:
  supabase functions deploy abibot
  supabase functions deploy waitlist

Test AbiBOT function:
  curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/abibot \
    -H "Content-Type: application/json" \
    -H "apikey: YOUR_ANON_KEY" \
    -d '{"category":"legal","language":"tr","messages":[{"role":"user","content":"Test"}]}'

═══════════════════════════════════════════════════
STEP 3 — WIRE SUPABASE INTO FRONTEND (~20 min)
═══════════════════════════════════════════════════

Open bizdenbize-client.js and replace:
  const SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
  const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';

With your actual values from Step 1.

The login.html already has Supabase auth calls wired —
just make sure bizdenbize-client.js is included and
SUPABASE_URL / SUPABASE_ANON are set correctly.

═══════════════════════════════════════════════════
STEP 4 — DEPLOY TO VERCEL (~20 min)
═══════════════════════════════════════════════════

Option A — Via GitHub (recommended):
  1. Create GitHub repo: github.com/new → "bizdenbize"
  2. Push your files:
       git init
       git add .
       git commit -m "Initial BizdenBize frontend"
       git remote add origin https://github.com/YOUR_USERNAME/bizdenbize.git
       git push -u origin main
  3. Go to https://vercel.com → Import project → select repo
  4. Framework: Other (static)
  5. Add Environment Variables:
       SUPABASE_URL         = https://xxx.supabase.co
       SUPABASE_ANON_KEY    = your_anon_key
  6. Deploy → takes ~1 minute

Option B — Vercel CLI:
  npm install -g vercel
  vercel login
  vercel --prod

═══════════════════════════════════════════════════
STEP 5 — CONNECT bizdenbize.com (~10 min)
═══════════════════════════════════════════════════

In Vercel:
  1. Settings → Domains → Add domain: bizdenbize.com
  2. Vercel gives you DNS records:
       Type: A      → 76.76.21.21
       Type: CNAME  → cname.vercel-dns.com

In your domain registrar (where you bought bizdenbize.com):
  1. Go to DNS settings
  2. Add the A record and CNAME record from Vercel
  3. Wait 5-30 minutes for propagation
  4. Vercel auto-issues SSL certificate (Let's Encrypt)
  5. bizdenbize.com is live with HTTPS ✓

═══════════════════════════════════════════════════
STEP 6 — RESEND EMAIL SETUP (~10 min)
═══════════════════════════════════════════════════

1. Go to https://resend.com → Sign up
2. Add domain: bizdenbize.com → verify DNS records
3. Get API key → add to Supabase secrets:
     supabase secrets set RESEND_API_KEY=re_your_key

4. Test waitlist form — submit on index.html
   → should receive confirmation email

═══════════════════════════════════════════════════
STEP 7 — STRIPE (Post-launch, ~1 hour)
═══════════════════════════════════════════════════

1. Go to https://stripe.com → Create account
2. Get API keys (test mode first)
3. Create products:
   - BizdenBize Premium Monthly: €9.99/month
   - BizdenBize Premium Annual:  €99.90/year
   - AbiBOT Starter Pack:        €9.99 (10 credits)
   - AbiBOT Standard Pack:       €19.99 (25 credits)
   - AbiBOT Pro Pack:            €39.99 (60 credits)
   - AbiBOT Max Pack:            €79.99 (150 credits)
4. Get price IDs → add to .env
5. Set up webhook → Supabase Edge Function
   (we'll build this in Phase 2)

═══════════════════════════════════════════════════
CHECKLIST BEFORE GOING LIVE
═══════════════════════════════════════════════════

□ Supabase project created (Frankfurt region)
□ schema.sql executed successfully
□ Edge functions deployed (abibot, waitlist)
□ bizdenbize-client.js has real Supabase URL + key
□ Vercel deployment working
□ bizdenbize.com DNS pointing to Vercel
□ SSL certificate active (https://)
□ Waitlist form submits and sends email
□ Login/register flow working
□ AbiBOT answers questions
□ legal.html has real company details (Impressum)
□ Cookie consent banner visible on first visit

═══════════════════════════════════════════════════
SUPPORT
═══════════════════════════════════════════════════

Supabase docs:  https://supabase.com/docs
Vercel docs:    https://vercel.com/docs
Resend docs:    https://resend.com/docs
Stripe docs:    https://stripe.com/docs
