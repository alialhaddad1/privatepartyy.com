/* 
You are Claude Sonnet 4.0. Edit ONLY the file: web/__tests__/createEvent.test.ts
Context: Unit test for creating an event and generating a QR code.
Tech stack: Next.js 14, TypeScript, Jest.
Requirements:
- Import generateQRCode and parseQRCode from src/lib/qr.ts
- Create a fake eventId = "test_event"
- Generate a QR code, assert it returns a valid data URL string
- Parse the QR code URL, assert it extracts "test_event"
- Ensure errors are handled gracefully if given invalid input
Return the complete file code.
*/