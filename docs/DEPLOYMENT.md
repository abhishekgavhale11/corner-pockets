# Deployment Guide — Vercel + MongoDB Atlas

Deploy Corner Pockets Phase 1 to production using Vercel (Next.js) and MongoDB Atlas.

> **Do not** run `db:reset` or `seed:sample` against production. The default admin account is created automatically on first startup when the Staff collection is empty.

---

## Overview

```
Staff browser → Vercel (Next.js 15) → MongoDB Atlas
                      ↓
              NextAuth (credentials)
```

---

## 1. MongoDB Atlas setup

### Create cluster

1. Sign in at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a **free or dedicated** cluster (M10+ recommended for production).
3. Choose a region close to your staff (e.g. Mumbai `ap-south-1`).

### Database access

1. **Database Access** → Add Database User.
2. Use username/password authentication.
3. Grant **Read and write** on the application database.

### Network access

1. **Network Access** → Add IP Address.
2. For Vercel: add `0.0.0.0/0` (allow from anywhere) — required because Vercel uses dynamic IPs.
3. For tighter security later, use Vercel Secure Compute or a private endpoint (advanced).

### Connection string

1. **Database** → Connect → Drivers.
2. Copy the connection string, e.g.:

```
mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/corner-pockets?retryWrites=true&w=majority
```

3. Replace `<user>` and `<password>` with your database user credentials.
4. Database name: `corner-pockets` (in the URI path).

---

## 2. Generate secrets

```bash
openssl rand -base64 32
```

Save the output as `AUTH_SECRET`.

---

## 3. Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

Follow prompts to link the project.

### Option B — GitHub integration

1. Push the repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import repository.
3. Framework preset: **Next.js** (auto-detected).

### Environment variables

In Vercel → Project → **Settings** → **Environment Variables**, add:

| Variable | Value | Environments |
|----------|-------|--------------|
| `MONGODB_URI` | Atlas connection string | Production, Preview |
| `AUTH_SECRET` | Output of `openssl rand -base64 32` | Production, Preview |
| `AUTH_URL` | `https://your-app.vercel.app` | Production |
| `AUTH_URL` | `https://your-preview-url.vercel.app` | Preview (optional) |

> After first deploy, set `AUTH_URL` to your actual production domain and redeploy.

**Do not** set `ALLOW_DB_RESET`, `CONFIRM_DB_RESET`, or `SEED_FORCE` in production.

### Deploy

```bash
vercel --prod
```

Or push to `main` if GitHub integration is enabled.

---

## 4. Post-deploy setup

### First deploy — default admin

On first startup, if no staff exist, the app automatically creates:

- Username: `admin`
- Password: `corner123`
- Name: Club Manager

**Change this password immediately in production** by updating the staff record in MongoDB until a password-change UI exists.

### Verify deployment

1. Open `https://your-app.vercel.app`
2. Login with staff credentials
3. Register one test customer
4. Run a small recharge and deduction
5. Confirm dashboard and transaction history update

---

## 5. Custom domain (optional)

1. Vercel → Project → **Domains** → Add domain.
2. Update DNS per Vercel instructions.
3. Update `AUTH_URL` to `https://yourdomain.com`.
4. Redeploy.

---

## 6. Production checklist

| Item | Status |
|------|--------|
| `AUTH_SECRET` is unique and not committed to git | ☐ |
| Default `corner123` password changed in production | ☐ |
| `MONGODB_URI` uses Atlas (not localhost) | ☐ |
| `AUTH_URL` matches production URL exactly | ☐ |
| Atlas backups enabled | ☐ |
| Atlas user has minimum required permissions | ☐ |
| `ALLOW_DB_RESET` not set in Vercel | ☐ |
| HTTPS enforced (Vercel default) | ☐ |

---

## 7. Monitoring and maintenance

- **Vercel**: Deployment logs, Analytics, optional Speed Insights.
- **Atlas**: Metrics, alerts, automated backups (paid tiers).
- **Indexes**: Created automatically by Mongoose on first use (`Customer`, `Transaction`, `Counter`).

---

## 8. Redeploying updates

```bash
git push origin main
```

Vercel rebuilds automatically. No database migration scripts are required for Phase 1 schema — Mongoose handles collection updates.

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| Login redirects loop | `AUTH_URL` must match deployed URL exactly (no trailing slash) |
| `MONGODB_URI` error at runtime | Check Vercel env vars; redeploy after adding them |
| Atlas connection timeout | Verify Network Access allows `0.0.0.0/0` or Vercel IPs |
| Middleware/auth errors on Edge | Auth config is split — ensure `AUTH_SECRET` is set |
| Build fails on Vercel | Run `npm run build` locally first; check Node version (20+) |

---

## 10. Local vs production environment summary

| Variable | Local dev | Vercel production |
|----------|-----------|---------------------|
| `MONGODB_URI` | `mongodb://localhost:27017/corner-pockets` | Atlas `mongodb+srv://...` |
| `AUTH_SECRET` | Any dev secret | Strong random secret |
| `AUTH_URL` | `http://localhost:3000` | `https://your-domain.com` |
| `ALLOW_DB_RESET` | Optional for Atlas dev | **Never set** |
| `CONFIRM_DB_RESET` | For `db:reset` only | **Never set** |
