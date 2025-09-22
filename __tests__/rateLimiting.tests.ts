/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/rateLimiting.test.ts
Context: Tests for spam prevention (rate limiting).
Tech stack: Next.js 14, TypeScript, Jest.
Requirements:
- Mock uploadPhoto function with in-memory counter
- Allow up to 10 uploads per minute per user
- Simulate 11 uploads within 1 minute → assert last one rejected
- Simulate 5 uploads, wait >1 minute, then 5 more → assert allowed
Return the complete file code.
*/