# Supabase Setup Guide for PrivatePartyy

This guide will help you set up the Supabase database for local development and testing.

## 🔑 Current Issue

**The events table doesn't exist in your Supabase database!** This is why event creation is failing.

## 📋 Quick Fix Steps

### 1. Access Supabase Dashboard

1. Go to [https://supabase.com](https://supabase.com)
2. Log in to your account
3. Select your project: `ekdqncrticnmckxgqmha`

### 2. Create Database Tables

1. In the Supabase dashboard, click on **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy and paste the entire contents of [`/infra/database-schema.sql`](./infra/database-schema.sql)
4. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

The script will create:
- ✅ `events` table - Stores event information
- ✅ `posts` table - Stores photos/posts for event feeds
- ✅ `post_likes` table - Tracks post likes
- ✅ `post_comments` table - Stores comments on posts
- ✅ Indexes for performance
- ✅ Sample data for testing

### 3. Verify Setup

Run the test script to verify everything works:

```bash
cd web
node test-supabase.mjs
```

You should see:
```
✅ Events table exists!
✅ Sample events: X found
✅ Test event created successfully!
✅ Test event deleted successfully!
✅ Supabase connection test completed!
```

### 4. Test Event Creation

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Click **Create Event**

4. Fill in:
   - **Event Name**: "My First Event"
   - **Description**: "Testing the app"
   - **Privacy**: Select Public or Private
   - Click **Create Event**

5. You should be redirected to a page showing a QR code! 🎉

## 🔍 Database Schema Overview

### Events Table
```sql
- id: UUID (Primary Key)
- title: VARCHAR(200) - Event name
- description: TEXT - Event description
- date: DATE - Event date
- time: VARCHAR(5) - Event time (HH:MM format)
- location: VARCHAR(500) - Event location
- max_attendees: INTEGER - Maximum attendees
- current_attendees: INTEGER - Current attendee count
- is_public: BOOLEAN - Public/Private flag
- host_id: VARCHAR(255) - Host identifier
- host_name: VARCHAR(255) - Host display name
- host_email: VARCHAR(255) - Host email
- tags: TEXT[] - Event tags
- image_url: TEXT - Event image
- token: VARCHAR(64) - Unique access token
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Posts Table
```sql
- id: UUID (Primary Key)
- event_id: UUID (Foreign Key to events)
- author_id: VARCHAR(255) - Post author
- author_name: VARCHAR(255) - Author display name
- author_avatar: TEXT - Author profile image
- content: TEXT - Text content
- image_url: TEXT - Image URL
- type: VARCHAR(20) - 'text' or 'image'
- likes: INTEGER - Like count
- comments: INTEGER - Comment count
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 🧪 Testing Supabase Operations

The app now includes comprehensive logging. Check the browser console and terminal for:

### Browser Console (F12 → Console)
- Event creation requests
- API responses
- Error messages with details

### Terminal (where you run `npm run dev`)
- API request logs with 📝 prefix
- Supabase operation details
- Error messages with ❌ prefix

Example output when creating an event:
```
📝 [Events API] POST request received
📝 [Events API] Request body: { "name": "Test Event", ... }
📝 [Events API] Inserting event: { "title": "Test Event", ... }
✅ [Events API] Event created successfully: abc123...
```

## 🐛 Troubleshooting

### Event Creation Still Fails

1. **Check environment variables**:
   ```bash
   cat web/.env.local
   ```
   Should contain:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ekdqncrticnmckxgqmha.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Restart the dev server**:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

3. **Check Supabase connection**:
   ```bash
   node web/test-supabase.mjs
   ```

4. **Check browser console** (F12):
   - Look for red error messages
   - Check Network tab for failed API calls
   - Look for 400/500 status codes

5. **Check terminal output**:
   - Look for error logs with ❌ prefix
   - Check for Supabase error details

### Table Doesn't Exist Error

If you see `relation "events" does not exist`:
- Re-run the database-schema.sql in Supabase SQL Editor
- Make sure you selected the correct project

### Permission Errors

If you see permission denied errors:
- Check that your `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify the key has full permissions (it should be the service_role key, not anon key)

## 📊 Monitoring in Supabase

1. **Table Editor**: View/edit data in your tables
2. **SQL Editor**: Run custom queries
3. **Logs**: Monitor API requests and errors
4. **Reports**: See usage statistics

## 🔒 Security Notes

- The `token` field in events table is unique and used for access control
- Public events (is_public=TRUE) are visible on the Events page
- Private events (is_public=FALSE) are only accessible via QR code/token
- Consider enabling Row Level Security (RLS) for production

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Database schema SQL executed successfully
- [ ] Environment variables configured in `.env.local`
- [ ] Test script (`test-supabase.mjs`) passes
- [ ] Dev server starts without errors
- [ ] Can create events from UI
- [ ] QR code displays after event creation
- [ ] Events page shows public events
- [ ] Can join events by scanning QR code

## 🎯 Next Steps

Once Supabase is set up:
1. Create test events (public and private)
2. Test QR code scanning on mobile
3. Upload photos to event feeds
4. Test social features (likes, comments)
5. Deploy to production!

## 📞 Need Help?

If you're still having issues:
1. Check the terminal output for detailed error messages
2. Check the browser console (F12) for client-side errors
3. Review the Supabase dashboard logs
4. Verify all environment variables are set correctly
