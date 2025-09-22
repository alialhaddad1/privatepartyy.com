/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/privacyLeakage.test.ts
Context: Tests for event-level isolation (no cross-leakage between events).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.from("posts").select
- Insert posts for eventA and eventB
- Fetch feed for eventA → assert only eventA posts returned
- Fetch feed for eventB → assert only eventB posts returned
- Attempt fetching with wrong/unauthorized eventId → assert empty result
Return the complete file code.
*/