/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/subscriptionWall.test.ts
Context: Tests for subscription wall (likes, comments, DMs behind paywall).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock feed render with free user → assert posts visible but likes/comments/DMs disabled
- Mock feed render with subscribed user → assert likes/comments/DMs enabled
- Ensure unauthorized interactions log a "Subscribe to unlock" warning
Return the complete file code.
*/