/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/uploadFeed.test.ts
Context: Integration test for uploading multiple photos to an event feed.
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.storage.from().upload and supabase.from("posts").insert
- Test uploading 5 photos → assert 5 inserts called
- Test uploading 10 photos → assert 10 inserts called
- Test uploading 20 photos → assert 20 inserts called
- Ensure file paths contain the correct eventId prefix
Return the complete file code.
*/