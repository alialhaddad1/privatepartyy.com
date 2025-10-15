# Vercel Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Created Vercel account
- [ ] Installed Vercel CLI (optional): `npm install -g vercel`
- [ ] GoDaddy domain access confirmed

### 2. Code Preparation
- [x] All dependencies installed: `npm install`
- [x] TypeScript types added (@types/qrcode)
- [x] Build tested successfully: `npm run build`
- [x] No TypeScript errors
- [x] All tests passing (if any)

### 3. Configuration Files
- [x] `.env.example` created with all required variables
- [x] `.gitignore` configured to exclude sensitive files
- [x] `next.config.cjs` configured with `output: 'standalone'`
- [x] `vercel.json` configured with cron jobs and headers
- [x] `package.json` has all required dependencies

### 4. Supabase Configuration
- [ ] Supabase project created
- [ ] Database tables created (see README.md)
- [ ] Row Level Security (RLS) policies configured
- [ ] Storage bucket created: `event-photos`
- [ ] Storage permissions configured
- [ ] API keys copied for environment variables

### 5. Environment Variables (Vercel)

Set these in Vercel Dashboard → Settings → Environment Variables:

**Required:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SUPABASE_SCHEMA`
- [ ] `NEXT_PUBLIC_BASE_URL` (set to `https://privatepartyy.com`)

**Security (Cron Jobs):**
- [ ] `CLEANUP_CRON_SECRET` (generate with: `openssl rand -base64 32`)
- [ ] `CLEANUP_API_KEY` (generate with: `openssl rand -base64 32`)

**Optional:**
- [ ] `SUPABASE_ACCESS_TOKEN`
- [ ] `database_password`

### 6. Domain Configuration (GoDaddy)

- [ ] Added A record: `@` → `76.76.21.21`
- [ ] Added CNAME record: `www` → `cname.vercel-dns.com.`
- [ ] Waited for DNS propagation (check at dnschecker.org)

### 7. Vercel Deployment

- [ ] Repository connected to Vercel
- [ ] Root directory set to: `web`
- [ ] Framework preset: Next.js
- [ ] Build command: `npm run build`
- [ ] Node version: 18.x or higher
- [ ] All environment variables configured
- [ ] Domain added in Vercel: `privatepartyy.com`
- [ ] SSL certificate auto-configured by Vercel

### 8. Supabase Production Settings

- [ ] Site URL set to: `https://privatepartyy.com`
- [ ] Redirect URLs configured:
  - `https://privatepartyy.com/**`
  - `https://www.privatepartyy.com/**`

### 9. Post-Deployment Testing

Test the following on production URL:

**Authentication:**
- [ ] Email signup works
- [ ] Email login works
- [ ] Quick login (magic link) works
- [ ] Session persistence works
- [ ] Logout works

**Events:**
- [ ] Create new event
- [ ] View event details
- [ ] QR code generates correctly with production URL
- [ ] Join event via QR scan/token
- [ ] Event feed loads

**Posts:**
- [ ] Upload photos
- [ ] View photos in feed
- [ ] Like posts
- [ ] Comment on posts
- [ ] Photos load from Supabase Storage

**Direct Messages:**
- [ ] Start DM thread
- [ ] Send messages
- [ ] Receive messages
- [ ] View DM history

**User Profiles:**
- [ ] View user profile
- [ ] Edit account settings
- [ ] Avatar upload/display

### 10. Monitoring & Maintenance

- [ ] Vercel Analytics enabled (optional)
- [ ] Error tracking configured (e.g., Sentry - optional)
- [ ] Cron jobs verified in Vercel dashboard
- [ ] Check logs for errors
- [ ] Set up uptime monitoring (optional)

### 11. Security Review

- [ ] `.env.local` not committed to git
- [ ] Environment variables set as secrets in Vercel
- [ ] Supabase RLS policies tested
- [ ] API endpoints secured with proper authentication
- [ ] Cron endpoints secured with API keys
- [ ] CORS headers properly configured
- [ ] HTTPS enforced (automatic with Vercel)

### 12. Performance

- [ ] Images optimized
- [ ] Next.js Image component used where applicable
- [ ] Build size reviewed
- [ ] Lighthouse score checked (optional)

## Common Issues & Solutions

### Build Fails
- Check Node version (should be 18+)
- Verify all dependencies in package.json
- Check build logs in Vercel dashboard
- Test build locally: `npm run build`

### Environment Variables Not Working
- Ensure variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables

### Domain Not Resolving
- DNS can take up to 48 hours to propagate
- Use dnschecker.org to verify
- Clear browser cache
- Try different browser/incognito mode

### Images Not Loading
- Verify Supabase Storage bucket permissions
- Check `next.config.cjs` image domains
- Verify CORS settings in Supabase

### Cron Jobs Not Running
- Verify Vercel plan supports cron jobs
- Check environment variables are set
- Review execution logs in Vercel dashboard

## Rollback Plan

If deployment has critical issues:

1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click ⋯ → "Promote to Production"
4. Investigate issue in staging/preview environment

## Post-Launch

After successful deployment:

1. Monitor application for 24-48 hours
2. Check Vercel logs daily for first week
3. Verify cron jobs execute successfully
4. Monitor Supabase usage/quotas
5. Collect user feedback
6. Plan for scaling if needed

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Deployment Guide**: See VERCEL_DEPLOYMENT.md

---

**Last Updated**: [Date]
**Production URL**: https://privatepartyy.com
