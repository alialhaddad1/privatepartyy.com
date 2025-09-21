/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/src/lib/qr.ts
Context: This is a utility module that generates and scans QR codes. It will be used for routing users into specific event feeds based on the event_id encoded in the QR.
Tech stack: Next.js 14, TypeScript, Supabase, TailwindCSS. Dependencies: qrcode, next/router.
Requirements:
- Export a function `generateQRCode(eventId: string): Promise<string>` that returns a data URL string of a QR code encoding `https://myapp.com/event/{eventId}`.
- Export a function `parseQRCode(url: string): string | null` that extracts the eventId from a scanned QR link.
- Handle errors gracefully (return null if QR cannot be parsed).
Return the complete file code.

*/