# Vercel Deployment Guide

This guide will walk you through deploying your PrivatePartyy.com app to Vercel and connecting it to your GoDaddy domain.

## Prerequisites

- A Vercel account ([sign up here](https://vercel.com/signup))
- A GoDaddy domain (privatepartyy.com)
- A Supabase project with your database set up
- Git repository with your code

## Step 1: Prepare Your Repository

1. Ensure all changes are committed:
```bash
cd web
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Install Dependencies

Before deploying, install the new TypeScript types:

```bash
npm install
```

## Step 3: Deploy to Vercel

**IMPORTANT:** Before deploying, you MUST configure environment variables (Step 4) to avoid build failures. The build will fail if Supabase environment variables are not set.

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. **BEFORE DEPLOYING**: Configure environment variables (see Step 4 below)
5. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
   - **Node Version**: 18.x or higher

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from the web directory
cd web
vercel
```

## Step 4: Configure Environment Variables

**CRITICAL:** These environment variables MUST be configured before your first deployment, otherwise the build will fail.

In your Vercel project settings, add the following environment variables:

### Required Variables:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Value: Your Supabase project URL (e.g., `https://ekdqncrticnmckxgqmha.supabase.co`)
   - Get from: Supabase Dashboard → Settings → API

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Value: Your Supabase anonymous key
   - Get from: Supabase Dashboard → Settings → API

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Value: Your Supabase service role key (keep this secret!)
   - Get from: Supabase Dashboard → Settings → API

4. **NEXT_PUBLIC_SUPABASE_SCHEMA**
   - Value: `public` (or your schema name)

5. **NEXT_PUBLIC_BASE_URL**
   - Value: `https://privatepartyy.com` (your production domain)

### Security Variables (for Cron Jobs):

6. **CLEANUP_CRON_SECRET**
   - Value: Generate a random secret (e.g., `openssl rand -base64 32`)
   - Purpose: Secures the cleanup-events cron job

7. **CLEANUP_API_KEY**
   - Value: Generate a random secret (e.g., `openssl rand -base64 32`)
   - Purpose: Secures the cleanup-event-dms cron job

### Optional Variables:

8. **SUPABASE_ACCESS_TOKEN**
   - Only needed for CLI operations

9. **database_password**
   - Only needed for direct database access

### Adding Environment Variables:

1. Go to your Vercel project
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - Key: Variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Value: Your actual value
   - Environments: Select **Production**, **Preview**, and **Development**
4. Click "Save"

## Step 5: Configure GoDaddy Domain

### Get Vercel DNS Information:

1. In Vercel, go to your project
2. Navigate to **Settings** → **Domains**
3. Click "Add Domain"
4. Enter `privatepartyy.com`
5. Vercel will show you the DNS records to add

### Update GoDaddy DNS:

1. Log into your [GoDaddy Domain Manager](https://dcc.godaddy.com/domains)
2. Find `privatepartyy.com` and click **DNS**
3. **First, check for existing records:**
   - Look for any existing `A`, `CNAME`, or `AAAA` records for `@` and `www`
   - **Delete or edit** any conflicting records (especially the default GoDaddy parking page records)

4. Add/Update the following records (as shown in Vercel):

   **For Root Domain (privatepartyy.com):**
   - Type: `A`
   - Name: `@`
   - Value: `76.76.21.21` (Vercel's IP)
   - TTL: 600 seconds
   - **Note:** If an `A` record for `@` exists, click the pencil icon to edit it instead of adding a new one

   **For WWW Subdomain:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com.`
   - TTL: 600 seconds
   - **Note:** If a `CNAME` or `A` record for `www` exists, **delete it first**, then add the new CNAME record

5. Save your DNS settings

**Note:** DNS propagation can take 24-48 hours but usually completes within a few hours.

## Step 6: Configure Vercel Cron Jobs

The app includes two automated cleanup jobs configured in `vercel.json`:

1. **cleanup-events**: Runs daily at 2:00 AM UTC - Deletes expired events
2. **cleanup-event-dms**: Runs daily at 3:00 AM UTC - Deletes DMs for expired events

### Vercel Cron Configuration:

Vercel automatically configures these cron jobs from `vercel.json`. However, you need to ensure:

1. Your environment variables `CLEANUP_CRON_SECRET` and `CLEANUP_API_KEY` are set
2. Cron jobs are enabled on your Vercel plan (available on Pro and Enterprise plans)

**Note:** On the Hobby plan, cron jobs are limited. Consider upgrading if you need reliable scheduled jobs.

## Step 7: Verify Deployment

### Test Your Deployment:

1. Visit `https://privatepartyy.com` (or your Vercel preview URL)
2. Test the following functionality:
   - Create an event
   - Join an event with QR code
   - Upload photos
   - View event feed
   - Test authentication flow

### Check Logs:

1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on the latest deployment
3. View **Build Logs** and **Function Logs** for any errors

### Monitor Cron Jobs:

1. Navigate to **Settings** → **Cron Jobs** in Vercel
2. View execution history and logs

## Step 8: Post-Deployment Configuration

### Update Supabase Settings:

1. Go to your Supabase project
2. Navigate to **Authentication** → **URL Configuration**
3. Add your production URL to **Site URL**: `https://privatepartyy.com`
4. Add to **Redirect URLs**:
   - `https://privatepartyy.com/**`
   - `https://www.privatepartyy.com/**`

### Test on Production:

- Test all authentication flows
- Verify image uploads work correctly
- Check that QR codes generate properly with production URLs
- Confirm event creation and joining works

## Troubleshooting

### Common Issues:

1. **"Error fetching data"**
   - Check that all environment variables are set correctly
   - Verify Supabase URL and keys are correct

2. **Images not loading**
   - Verify `next.config.cjs` has correct image domains
   - Check Supabase Storage permissions

3. **Cron jobs not running**
   - Verify you're on a Vercel plan that supports cron jobs
   - Check environment variables for `CLEANUP_CRON_SECRET` and `CLEANUP_API_KEY`

4. **DNS not resolving**
   - DNS can take up to 48 hours to propagate
   - Use [DNS Checker](https://dnschecker.org/) to verify propagation
   - Clear your browser cache

5. **"www" record conflicts with another record**
   - Delete the existing "www" record in GoDaddy DNS settings
   - GoDaddy often creates default parking page records that must be removed
   - You can only have ONE record per name (can't have multiple "www" records)

5. **Build failures**
   - Check build logs in Vercel dashboard
   - Verify all dependencies are in `package.json`
   - Ensure Node version is 18 or higher

## Rollback

If you need to rollback to a previous deployment:

1. Go to Vercel Dashboard → **Deployments**
2. Find the previous working deployment
3. Click the three dots (⋯) → **Promote to Production**

## Monitoring & Analytics

### Vercel Analytics:

Enable Vercel Analytics for performance monitoring:
1. Go to your project → **Analytics**
2. Click "Enable Analytics"

### Custom Monitoring:

Consider adding:
- Error tracking (e.g., Sentry)
- User analytics (e.g., PostHog, Plausible)
- Uptime monitoring (e.g., UptimeRobot)

## Security Checklist

Before going live, verify:

- [ ] All sensitive environment variables are set as secrets in Vercel
- [ ] `.env.local` is in `.gitignore` and not committed
- [ ] Supabase RLS (Row Level Security) policies are properly configured
- [ ] Cleanup cron jobs are secured with API keys
- [ ] HTTPS is enforced (Vercel does this automatically)
- [ ] CORS headers are properly configured
- [ ] Rate limiting is considered for API endpoints

## Support

- Vercel Documentation: https://vercel.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Supabase Documentation: https://supabase.com/docs

## Next Steps

After successful deployment:

1. Set up domain email (if needed)
2. Configure SSL certificate (automatic with Vercel)
3. Set up monitoring and alerts
4. Plan for scaling (if expecting high traffic)
5. Consider CDN configuration for better performance
6. Set up automated backups for Supabase

---

**Deployment Date**: [Add date when deployed]
**Deployed By**: [Add your name]
**Production URL**: https://privatepartyy.com
