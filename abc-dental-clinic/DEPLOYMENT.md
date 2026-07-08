# Deploying ABC Dental Clinic to Production

This guide takes you from a **local VS Code project** → **live public URL** in ~15 minutes using free tiers.

## Architecture
- **MongoDB Atlas** (free M0) — the database
- **Render** (free tier) — hosts the FastAPI backend
- **Vercel** (free tier) — hosts the React frontend

Total monthly cost for a small clinic: **$0** (upgrade only when you scale beyond ~500 patients).

---

## Step 0 — Prerequisites

1. A GitHub account
2. Your code pushed to a GitHub repo (see "Push to GitHub" below)
3. A MongoDB Atlas account: https://www.mongodb.com/cloud/atlas/register
4. A Render account: https://render.com/register  (sign in with GitHub)
5. A Vercel account: https://vercel.com/signup  (sign in with GitHub)

---

## Step 1 — Push code to GitHub

From your local project folder (in VS Code terminal):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
# Create the repo first on github.com (empty, no README), then:
git remote add origin https://github.com/YOUR_USERNAME/abc-dental-clinic.git
git push -u origin main
```

> ⚠️ Make sure `.env` is in `.gitignore` (it already is in the bundle I gave you). Never commit real credentials.

---

## Step 2 — Set up MongoDB Atlas (free)

1. Sign in → **Build a Database** → **Free M0 shared cluster** → choose closest region (e.g. Mumbai / Singapore)
2. Under **Database Access** → **Add a new user**
   - Username: `dental_admin`
   - Password: (generate strong, save it)
3. Under **Network Access** → **Add IP Address** → **Allow access from anywhere** (0.0.0.0/0) — required so Render can reach it
4. Click **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://dental_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with your actual password. Save this — you'll paste it into Render.

---

## Step 3 — Deploy the backend on Render

1. Render Dashboard → **New +** → **Web Service**
2. Connect your GitHub repo → select `abc-dental-clinic`
3. Fill in:
   - **Name**: `abc-dental-clinic-api`
   - **Region**: closest to your users
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan**: **Free**

4. Click **Advanced** → add these Environment Variables (copy from your local `.env`):
   | Key | Value |
   |---|---|
   | `MONGO_URL` | `mongodb+srv://...` (from Atlas) |
   | `DB_NAME` | `dental_clinic_db` |
   | `CORS_ORIGINS` | `https://YOUR-VERCEL-DOMAIN.vercel.app` (add after Step 4) |
   | `JWT_SECRET` | (generate a 64-char random string) |
   | `ADMIN_EMAIL` | `admin@abcdental.com` |
   | `ADMIN_PASSWORD` | (strong password) |
   | `DOCTOR_EMAIL` | `doctor@abcdental.com` |
   | `DOCTOR_PASSWORD` | (strong password) |
   | `RECEPTIONIST_EMAIL` | `reception@abcdental.com` |
   | `RECEPTIONIST_PASSWORD` | (strong password) |
   | `APP_NAME` | `abc-dental-clinic` |
   | `TWILIO_ACCOUNT_SID` | `AC...` (your Twilio) |
   | `TWILIO_AUTH_TOKEN` | (your Twilio auth) |
   | `TWILIO_FROM_NUMBER` | `+1...` |
   | `REMINDER_CRON_HOUR` | `20` |
   | `REMINDER_CRON_MINUTE` | `0` |
   | `REMINDER_TIMEZONE` | `Asia/Kolkata` |
   | `EMERGENT_LLM_KEY` | (skip — this was for object storage on Emergent; on Render you don't need it. File uploads will fail gracefully.) |

5. Click **Create Web Service** → wait ~3 minutes for build
6. Copy your Render URL (e.g. `https://abc-dental-clinic-api.onrender.com`) — you'll paste it into Vercel next

> **Free tier note**: Render's free plan spins down after 15 min of inactivity. First request after idle takes ~30s to wake. For always-on, upgrade to $7/mo Starter.

Test the backend: `https://abc-dental-clinic-api.onrender.com/api/` → should return `{"ok":true,"service":"ABC Dental Clinic API"}`.

---

## Step 4 — Deploy the frontend on Vercel

1. Vercel Dashboard → **Add New… → Project**
2. **Import** your GitHub repo
3. Configure:
   - **Framework Preset**: **Create React App**
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn build` (default is fine)
   - **Output Directory**: `build` (default)
   - **Install Command**: `yarn install`

4. **Environment Variables** → add:
   | Key | Value |
   |---|---|
   | `REACT_APP_BACKEND_URL` | `https://abc-dental-clinic-api.onrender.com` (from Step 3) |

5. Click **Deploy** → wait ~2 minutes → done!

6. Copy your Vercel URL (e.g. `https://abc-dental-clinic.vercel.app`)

7. **Go back to Render** → Environment tab → update `CORS_ORIGINS` = `https://abc-dental-clinic.vercel.app` → Save (Render auto-restarts)

---

## Step 5 — Verify end-to-end

Open `https://abc-dental-clinic.vercel.app/login` → sign in with your admin credentials → all features should work exactly like preview.

Patient portal: `https://abc-dental-clinic.vercel.app/portal/login`

---

## Custom domain (optional)

**Vercel** (frontend):
- Project → **Domains** → add `clinic.yourdomain.com` → follow DNS instructions (add a CNAME record)

**Render** (backend, optional):
- Service → **Settings → Custom Domain** → add `api.yourdomain.com` → follow DNS instructions

Then update Vercel env: `REACT_APP_BACKEND_URL = https://api.yourdomain.com`.

---

## Auto-deploy on git push

Both Render and Vercel **auto-deploy on every push to `main`** by default. Nothing else to configure:

```bash
# Make changes locally
git add .
git commit -m "your change"
git push
```

Within ~2 minutes Vercel + Render will build and deploy the new version.

---

## Alternative: Railway (single dashboard for both)

If you'd rather host both backend + frontend in one place:

1. https://railway.app → **New Project → Deploy from GitHub**
2. Add two services from the same repo:
   - Service 1: root `/backend`, start `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Service 2: root `/frontend`, static build (framework auto-detected)
3. Add MongoDB plugin → Railway auto-injects `MONGO_URL`
4. Set env vars just like Render steps above

Railway free tier gives ~$5 credits/month, ~500 hours of runtime.

---

## Troubleshooting

**Backend won't start** → check Render **Logs** tab. Common issue: `pip install` failing on a specific package. Usually a version conflict — pin the failing package in `requirements.txt`.

**"CORS blocked" in browser console** → make sure `CORS_ORIGINS` in Render env matches your Vercel URL exactly (no trailing slash).

**"Cannot connect to MongoDB"** → check Atlas Network Access includes `0.0.0.0/0`. Also check your MONGO_URL password is URL-encoded (special chars like `@` become `%40`).

**"401 Unauthorized" on login** → JWT_SECRET differs between build and runtime. Set it once and never change.

**Free-tier cold start (30s)** → the first request after 15 min of idle is slow on Render Free. Upgrade to Starter ($7/mo) for always-on.
