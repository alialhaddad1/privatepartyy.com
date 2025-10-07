# User Profiles & Cross-Event Persistence

## Overview

Users now create persistent profiles when joining events. Profiles are identified by email and maintained across all events, allowing users to keep their identity and preferences without re-entering information.

## Profile Structure

```json
{
  "id": "user_1234567890_abc123",
  "name": "AB" or "Anonymous",
  "email": "user@example.com",
  "generation": "gen-z" | "millennial" | "gen-x" | "boomer" | "silent" | null,
  "avatar": "😎",
  "isAnonymous": false,
  "createdAt": "2025-10-07T...",
  "updatedAt": "2025-10-07T..."
}
```

## Profile Fields

### Required Fields

1. **Email** - Used as the unique identifier for cross-event persistence
   - Validated format: `user@example.com`
   - Stored in lowercase
   - Purpose: Enables users to maintain their profile across events and devices

2. **Name/Initials**
   - **Anonymous**: Name is automatically set to "Anonymous"
   - **With Initials**: 1-3 character initials (e.g., "AB", "JDO")

3. **Avatar** - Emoji selected from 16 options
   - Options: 😊, 😎, 🎉, 🎨, 🎵, ⚡, 🌟, 🔥, 💜, 💙, 💚, 🧡, 🎭, 🎪, 🎯, ✨

### Optional Fields

1. **Generation** - Age group selection
   - Gen Z (1997-2012)
   - Millennial (1981-1996)
   - Gen X (1965-1980)
   - Boomer (1946-1964)
   - Silent Gen (1928-1945)
   - Prefer not to say (default)

## User Flow

### First-Time User

1. Scan QR code → Redirected to `/join/[eventId]?token=xxx`
2. Choose: **Anonymous** or **With Initials**
3. Enter email address (required)
4. If "With Initials": Enter 1-3 character initials
5. Select generation (optional)
6. Pick emoji avatar
7. Click "Join Event"
8. Profile is:
   - Saved to Supabase database
   - Stored in localStorage
   - Used across all future events

### Returning User (Same Device)

1. Scan QR code
2. Profile loaded from localStorage
3. **Instantly redirected to event** (0 clicks!)

### Returning User (New Device, Same Email)

1. Scan QR code → Redirected to `/join/[eventId]`
2. Enter same email address
3. Existing profile automatically loaded from database
4. User can update initials, generation, or avatar
5. Click "Join Event"
6. Profile updated and synced

## Backend Implementation

### API Endpoint: `/api/users/profile`

#### POST - Create or Update Profile

**Request:**
```json
{
  "id": "user_1234567890_abc123",
  "name": "AB",
  "email": "user@example.com",
  "generation": "gen-z",
  "avatar": "😎",
  "isAnonymous": false,
  "createdAt": "2025-10-07T..."
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "user_1234567890_abc123",
    "name": "AB",
    "email": "user@example.com",
    "generation": "gen-z",
    "avatar": "😎",
    "isAnonymous": false,
    "createdAt": "2025-10-07T...",
    "updatedAt": "2025-10-07T..."
  }
}
```

**Logic:**
- Checks if profile with email exists
- **Exists**: Updates existing profile with new data
- **New**: Creates new profile with provided data

#### GET - Fetch Profile by Email

**Request:**
```
GET /api/users/profile?email=user@example.com
```

**Response:**
```json
{
  "profile": {
    "id": "user_1234567890_abc123",
    "name": "AB",
    "email": "user@example.com",
    "generation": "gen-z",
    "avatar": "😎",
    "isAnonymous": false,
    "createdAt": "2025-10-07T...",
    "updatedAt": "2025-10-07T..."
  }
}
```

**Error Response (Not Found):**
```json
{
  "error": "Profile not found"
}
```

### Database Schema

**Table:** `api.user_profiles`

```sql
CREATE TABLE api.user_profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar VARCHAR(10) NOT NULL,
  generation VARCHAR(50),
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- `idx_user_profiles_email` - Fast lookups by email
- `idx_user_profiles_created_at` - Chronological queries

## Setup Instructions

1. **Run the SQL schema** in Supabase SQL Editor:
   ```bash
   infra/user-profiles-schema.sql
   ```

2. **Verify table creation:**
   ```sql
   SELECT * FROM api.user_profiles LIMIT 5;
   ```

3. **Test the API:**
   ```bash
   # Create profile
   curl -X POST http://localhost:3000/api/users/profile \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test_user_123",
       "name": "AB",
       "email": "test@example.com",
       "avatar": "😎",
       "generation": "gen-z",
       "isAnonymous": false,
       "createdAt": "2025-10-07T12:00:00Z"
     }'

   # Fetch profile
   curl http://localhost:3000/api/users/profile?email=test@example.com
   ```

## Data Storage

### localStorage
- **Purpose**: Instant access on same device
- **Key**: `userProfile`
- **Persistence**: Until browser cache is cleared
- **Sync**: One-way (localStorage → page load)

### Supabase Database
- **Purpose**: Cross-event and cross-device persistence
- **Lookup**: By email address
- **Persistence**: Permanent (until deleted)
- **Sync**: Bidirectional (check on join, update on changes)

## Privacy & Security

- Email is required but only used for profile identification
- No passwords or authentication required
- Profiles are public within events (visible to other attendees)
- Users can be anonymous (name = "Anonymous")
- Generation is entirely optional
- Data is stored in Supabase with standard security

## Files Modified/Created

### New Files
- `web/src/pages/api/users/profile.ts` - Profile API endpoint
- `infra/user-profiles-schema.sql` - Database schema
- `USER_PROFILES.md` - This documentation

### Modified Files
- `web/src/pages/join/[id].tsx` - Added email and generation fields
- `web/src/components/UploadWidget.tsx` - Updated to use profile data
- `web/src/pages/event/[id].tsx` - Loads profile from localStorage

## Benefits

✅ **One-time setup** - Enter info once, use everywhere
✅ **Cross-event persistence** - Same profile across all events
✅ **Cross-device support** - Access profile from any device via email
✅ **Minimal friction** - Email + 2-3 fields = done
✅ **Privacy-friendly** - Optional anonymous mode
✅ **Fast** - localStorage for instant access, backend for sync
✅ **Flexible** - Update profile anytime (future feature)
