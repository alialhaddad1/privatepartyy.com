/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/security.test.ts
Context: Security test for feed access via QR code.
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock a function fetchFeed(eventId: string)
- Test: user with correct eventId ("test_event") can retrieve posts
- Test: user with invalid eventId ("wrong_event") gets empty result or error
- Test: eventId = null or undefined returns 403-like error
- Test: ensure no posts are leaked if eventId does not match
Return the complete file code.
*/