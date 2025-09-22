/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/malformedEventIds.test.ts
Context: Tests for malformed event IDs and injection attempts.
Tech stack: Next.js 14, TypeScript, Jest.
Requirements:
- Call fetchFeed with eventId = "DROP TABLE posts;" → assert rejected / sanitized
- Call fetchFeed with very long string (>255 chars) → assert validation error
- Call fetchFeed with unicode characters (emoji, RTL text) → assert accepted or safely handled
- Call generateQRCode with invalid IDs → assert rejection
Return the complete file code.
*/