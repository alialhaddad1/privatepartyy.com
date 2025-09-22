/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/dataConsistency.test.ts
Context: Tests for data consistency (upload succeeds, DB insert fails).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.storage.upload → success
- Mock supabase.from("posts").insert → failure
- Assert orphaned file cleanup is triggered (storage.remove called)
- If both succeed → assert no cleanup triggered
Return the complete file code.
*/