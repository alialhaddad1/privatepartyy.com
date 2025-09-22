/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/crossDevice.test.ts
Context: Simulated cross-device behavior for QR scanning and uploading.
Tech stack: Next.js 14, TypeScript, Jest, jsdom.
Requirements:
- Mock scanning QR via Safari (iOS) and ensure URL parses correctly
- Mock scanning QR via Chrome (Android) and ensure same eventId extracted
- Simulate photo upload on iOS (jpg) → assert success
- Simulate photo upload on Android (png) → assert success
Return the complete file code.
*/