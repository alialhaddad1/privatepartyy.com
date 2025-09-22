/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/errorHandling.test.ts
Context: Tests for failure scenarios (Supabase errors, QR errors).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.storage.upload to throw network error → assert graceful error returned
- Mock supabase.from("posts").insert to fail → assert proper error logged
- Call parseQRCode with invalid URL → assert null returned
- Call generateQRCode with empty eventId → assert it rejects
Return the complete file code.
*/