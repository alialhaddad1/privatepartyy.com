# Event Auto-Cleanup Documentation

## Overview

Events are automatically deleted at the end of their event day (after the date has passed). This keeps the database clean and ensures expired events don't clutter the system.

## How It Works

Events are deleted when their `date` field is **before** the current day. For example:
- An event on `2025-10-07` will be deleted starting on `2025-10-08` at 2 AM UTC
- Events are NOT deleted on their event day - only after the day has passed

## Implementation Options

### Option 1: Vercel Cron Job (Recommended for Production)

The project includes a `vercel.json` configuration that sets up automatic cleanup:

```json
{
  "crons": [
    {
      "path": "/api/cleanup-events",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2 AM UTC. Vercel Cron Jobs are:
- ✅ Free on Vercel Pro plans
- ✅ Reliable and managed
- ✅ No database extensions required

**Setup:**
1. Deploy to Vercel
2. The cron job is automatically configured
3. (Optional) Set `CLEANUP_CRON_SECRET` environment variable for authentication

### Option 2: Database Function (Supabase)

A SQL function is provided in `infra/event-cleanup.sql`:

```sql
SELECT cleanup_expired_events();
```

**Setup:**
1. Run the SQL script in Supabase SQL Editor
2. Optionally enable pg_cron extension for automatic scheduling
3. Or call the function manually/via API

### Option 3: Manual API Call

You can manually trigger cleanup by calling the API endpoint:

```bash
POST https://your-domain.com/api/cleanup-events
Authorization: Bearer YOUR_CLEANUP_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 5,
  "message": "Deleted 5 expired event(s)"
}
```

## Security

The cleanup API endpoint includes optional authentication:

1. Set `CLEANUP_CRON_SECRET` environment variable
2. Include in requests: `Authorization: Bearer YOUR_SECRET`
3. Without the secret, the endpoint is public (safe for cron jobs but consider adding auth)

## Testing

### Test the API Endpoint Locally

```bash
# Install dependencies
cd web
npm install

# Start dev server
npm run dev

# Call the cleanup endpoint
curl -X POST http://localhost:3000/api/cleanup-events \
  -H "Content-Type: application/json"
```

### Test the SQL Function

```sql
-- See which events would be deleted
SELECT id, title, date FROM events WHERE date < CURRENT_DATE;

-- Run cleanup
SELECT * FROM cleanup_expired_events();
```

### Create Test Data

```sql
-- Create an expired event (yesterday)
INSERT INTO events (title, date, time, host_id, token)
VALUES (
  'Test Expired Event',
  CURRENT_DATE - INTERVAL '1 day',
  '18:00',
  'test-host',
  'test-expired-' || gen_random_uuid()
);

-- Create a current event (today)
INSERT INTO events (title, date, time, host_id, token)
VALUES (
  'Test Current Event',
  CURRENT_DATE,
  '18:00',
  'test-host',
  'test-current-' || gen_random_uuid()
);

-- Run cleanup (should only delete yesterday's event)
SELECT * FROM cleanup_expired_events();
```

## Monitoring

Check cleanup logs in:
- **Vercel Dashboard** → Functions → Logs (for cron jobs)
- **Supabase Dashboard** → Logs (for database operations)
- **Application logs** when calling the API endpoint

## Customization

### Change Cleanup Schedule

Edit `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cleanup-events",
    "schedule": "0 6 * * *"  // 6 AM UTC instead of 2 AM
  }]
}
```

### Keep Events Longer

Modify the cleanup logic in `/api/cleanup-events.ts`:

```typescript
// Delete events 7 days after their date
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 7);
const cutoffString = cutoffDate.toISOString().split('T')[0];

await supabase
  .from('events')
  .delete()
  .lt('date', cutoffString);
```

## Troubleshooting

### Cron job not running

1. Check Vercel Dashboard → Project → Settings → Crons
2. Verify the cron schedule format
3. Check function logs for errors

### Events not deleting

1. Verify database permissions
2. Check API endpoint logs
3. Manually run: `SELECT * FROM cleanup_expired_events();`
4. Ensure events have valid `date` fields
5. **IMPORTANT**: Verify the Supabase schema is set to `'api'` in the cleanup-events.ts file (not `'public'`)

### Authentication errors

1. Set `CLEANUP_CRON_SECRET` in environment variables
2. Include the header: `Authorization: Bearer YOUR_SECRET`
3. Or remove auth check for public cron access

### Schema errors ("The schema must be one of the following: api")

1. Ensure the Supabase client in `cleanup-events.ts` uses `db: { schema: 'api' }`
2. This should match the schema used in the main events API
