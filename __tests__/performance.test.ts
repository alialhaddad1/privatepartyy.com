/* 
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/performance.test.ts
Context: Performance test for uploading and fetching large numbers of photos.
Tech stack: Next.js 14, TypeScript, Jest (with jest.setTimeout).
Requirements:
- Mock supabase.from("posts").insert and supabase.from("posts").select
- Simulate uploading 100 photos and assert all inserts succeed
- Simulate retrieving 500 posts for an event and ensure result length is correct
- Use performance.now() to measure elapsed time for fetch (assert under 2s)
Return the complete file code.
*/