/* 
Task: Generate the landing page for PrivatePartyy.com in Next.js + TypeScript.
File: src/pages/index.tsx

Context:
- App allows users to host events (create) or join events (scan QR code).
- This page has two primary buttons: "Create Event" and "Join Event".
- Clicking "Create Event" opens a modal or form to POST to /api/events (creates event in Supabase, returns eventId + token).
- Clicking "Join Event" opens a QRScanner component to scan QR code and navigate to /event/[id]?token=...
- This page will import Header.tsx for navigation.
- Form should be minimal, fast, mobile-friendly.
- Use Tailwind or inline CSS for layout if needed.

Deliverable:
- React functional component.
- Export default.
- Include interactions to call backend API for creating an event.
- Include client-side routing to /event/[id] after joining.
- Return code only.

*/