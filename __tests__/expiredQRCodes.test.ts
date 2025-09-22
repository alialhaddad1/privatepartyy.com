/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/expiredQrCodes.test.ts
Context: Tests for expired QR codes (event has passed).
Tech stack: Next.js 14, TypeScript, Jest, Supabase (mocked).
Requirements:
- Mock supabase.from("events").select returning expired event (date < NOW())
- Attempt fetchFeed → assert error "Event expired"
- Generate QR code with expired event → assert rejected
- Valid event (future date) should pass normally
Return the complete file code.
*/