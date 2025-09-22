/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/concurrentUploads.test.ts
Context: Tests for concurrent uploads (two users uploading at the same time).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.from("posts").insert
- Use Promise.all to simulate two users uploading different photos at the same time
- Assert both inserts succeed without conflict
- Simulate 10 concurrent uploads → assert all inserts called exactly 10 times
Return the complete file code.
*/