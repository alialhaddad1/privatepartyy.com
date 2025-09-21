[ User Browser ]  <--HTTPS-->  [ Vercel Next.js App (frontend) ]
     |                                    |
     |                                    |- /api/* proxy (serverless functions on Vercel)
     |                                    |
     |                                    `-- Static pages + SSR + client-side JS
     |
     |
     +--QR Scan / open URL--> https://privatepartyy.com/event/<eventId>
                                         |
                                         v
                                  [Supabase REST/JS SDK]
                                         |
                           +-------------+--------------+
                           |                            |
                   [Supabase Postgres]            [Supabase Storage (photos)]
                   - users, events, posts,        - photos stored by eventId/
                     likes, comments, dms           object path
                   - Row-Level Security            - metadata: uploaded_at, ttl
                                                     (Edge function deletes)
                           |
                           v
                  [Supabase Edge Functions]
                  - Issue time-limited signed URLs for uploads/downloads
                  - Enforce guest-only access to event feeds
                  - Scheduled cleanup for TTL deletion (or cron)
                           |
                           v
                 [Optional Services]
                 - SendGrid (emails)   - Analytics: Plausible / PostHog OSS
                 - Cloudinary (image CDN/transform) - Twilio (SMS if needed)

=====================================================SECURITY RULES=====================================================

Security & Privacy specifics (prototype-focused)
Access control
Use event token as primary gate for read/write for event resources and set RLS policies in Supabase:
posts SELECT/INSERT/DELETE allowed if exists (select 1 from event_guests where event_id = posts.event_id and qr_token = requested_token) or if event is public.
Store tokens hashed (or opaque UUIDs) and use signed URLs for media.

Media privacy & protections
Important: On the web, you cannot reliably prevent screenshots. Explain to client:
You can make right-click save harder (disable context menu, serve images via canvas or CSS background), add watermarks or overlay, and only provide low-resolution versions on web.
You cannot stop OS-level screenshotting (iOS/Android or macOS/Windows) or screen capture.

Image download prevention steps (prototype-level):
Serve images via a dynamic canvas element so the image is not a straightforward <img src> (makes saving slightly more effort).
Use signed short-lived image URLs so that links expire.
Overlay visible watermark or event name + timestamp.
Use CSS -webkit-user-select: none; pointer-events: none; on the image container (UX trade-off).
For production-level DRM you'd need paid services or native apps with platform DRM.

Data retention (TTL deletion)
Implement media_ttl table with expire_at. Use Supabase Edge function scheduled (via cron) to delete expired objects.
Alternatively, if migrating to S3 later, set lifecycle rules to delete objects after X days.

Privacy policy & GDPR
Provide clear privacy notice on landing page.

Allow users to request deletion of their data — implement endpoint DELETE /api/users/:id with verification.

=====================================================STORAGE SPECIFICS=====================================================

How much storage / can you fit on a free plan?
Supabase free tier: includes a small amount of storage and DB rows for prototypes. For photo-heavy events, free tier may be limited.

For prototype:
Limit photo uploads per user/event (e.g., 10–50 photos/event) and client-side compress images to ~200–500KB.
Use aggressive TTL (e.g., delete within 48 hours) to free storage.
If usage grows, migrate media to S3 or Cloudinary, keep metadata in Postgres.

Use Supabase Storage buckets to store photos, and keep only file URLs in your actual table. 

=====================================================PUBLIC DEPLOYMENT=====================================================

Quick public deployment steps (prototype)
Push code to GitHub.
Connect GitHub repo to Vercel; set environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (only used on server), SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL, etc.

On Vercel, choose your scope and project. It’ll auto-deploy preview branches and main.
Buy domain privatepartyy.com (if not owned) and add it to Vercel (free). Update DNS (CNAME) per Vercel instructions.
Set up the same environment in production.

Scaling path
Start with Supabase + Vercel. If you need extreme scale or advanced image CDN, move media to S3 + CloudFront or Cloudinary. Keep Postgres on Supabase or migrate to managed Postgres (Heroku/Azure/AWS RDS) later.

=====================================================TESTING=====================================================

Tests & running locally
Local dev setup (steps)

Install Node (>=16), npm.
Clone repo.
cd web
npm install

Create .env.local with:

NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # only used for server-side operations


Setup Supabase:
Create project on supabase.com (free tier).
Run SQL migrations (infra/supabase/migrations) using Supabase CLI or SQL editor.
Enable Storage bucket (e.g., event-photos).
Setup RLS policies (we’ll provide SQL snippets).

Start dev server:
npm run dev
# default: http://localhost:3000

Tests to run for each page (manual + automated suggestions)
Landing (/)

Manual:
Click “Create Event” → fill form → submit → receive eventId & token.
Click “Join Event” → open QR scanner → scan a test QR (or paste token) → redirect to /event/<id>?token=....

Automated:
Unit test for CreateEventForm validation (Jest + React Testing Library).
Host QR page (/host/qr/[id])

Manual:
Visit /host/qr/<id>?hostToken=... and view QR.
Click "Regenerate token" → ensure old token no longer returns feed.

Tests:
API test: curl POST /api/events/:id/qr/regenerate and verify DB token changed.
Event feed (/event/[id])

Manual:
Visit feed with token param → see posts (initially none).
Upload a photo via UploadWidget → image appears in feed after upload completes.
Click like → post shows incremented like count.
Click comment → comment appears (if not locked).

API tests:
Use curl or Postman:
GET /api/events/<id>/posts?token=XXXX should return posts array.
POST /api/events/<id>/posts with signed upload flow should create a DB row.

Profile page
Manual:
Click on uploader name on post → navigate to /profile/<uploaderId> show initials/avatar.
Verify socials are hidden unless subscription flag present.

Tests:
GET /api/users/<id> returns only allowed public fields.

DM page
Manual:
Open a DM thread and send a message. Verify the other end (in another session) sees it.
If DMs locked behind subscription, show prompt.

Tests:
POST /api/dms/<thread> stores message then GET returns it.
How to run tests locally (example)
Unit tests: npm run test

Integration (manual): Use Postman or curl commands:
curl -X POST http://localhost:3000/api/events -H "Content-Type: application/json" -d '{"title":"Test","is_private":false,"guest_limit":100}'

=====================================================TABLE CREATION=====================================================

Recommended SQL snippets & RLS starter (Supabase)

Create tables (simplified)

-- users table (supabase defaults also create auth.users)
create table app_users (
  id uuid primary key default gen_random_uuid(),
  auth_uid text, -- map to supabase auth user id if used
  email text,
  display_name text,
  generation text,
  avatar_url text,
  allow_dms boolean default true,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid references app_users(id),
  title text,
  is_private boolean default true,
  access_token text, -- opaque token
  guest_limit int default 0,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  user_id uuid references app_users(id),
  image_path text,
  caption text,
  created_at timestamptz default now()
);

create table media_ttl (
  id uuid primary key default gen_random_uuid(),
  storage_path text,
  expire_at timestamptz
);

RLS approach

Enable RLS on posts.

Allow SELECT if event is public OR request has valid token (you'll implement authentication for server calls). For prototype you can validate token in Edge function and pass a supabase session that can query.
