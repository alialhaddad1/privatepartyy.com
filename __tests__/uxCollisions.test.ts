/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/uxCollisions.test.ts
Context: Tests for anonymous user experience (name collisions, invalid file uploads).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Simulate two users both uploading as "Alice"
- Ensure feed still distinguishes them by post.id
- Try uploading an unsupported file type (.exe) → assert validation error
- Try uploading a large file >10MB → assert rejection
Return the complete file code.
*/