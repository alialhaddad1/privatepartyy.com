/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/storageDeletion.test.ts
Context: Tests for temporary photo expiry and deletion policies.
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.storage.from().remove and supabase.from("posts").delete
- Insert 3 posts with created_at timestamps older than 12 hours
- Run cleanup function → assert those posts and files are deleted
- Insert 2 posts within the last 2 hours → assert they are not deleted
- Ensure cleanup logs which posts were deleted
Return the complete file code.
*/