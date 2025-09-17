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

To be continued