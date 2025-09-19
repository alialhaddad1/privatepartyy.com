/* 
Task: Generate host QR page for PrivatePartyy.com in Next.js + TypeScript.
File: src/pages/host/qr/[id].tsx

Context:
- Shows a unique QR code for an event.
- Host can click a button to go to feed (/event/[id]).
- Imports Header.tsx.
- Uses QR display component (QRCodeDisplay.tsx) to render token.
- GETs event info via /api/events/:id/qr using eventId from URL param.
- Optional: Regenerate token via POST /api/events/:id/qr/regenerate.

Deliverable:
- React functional component with getServerSideProps to fetch event info.
- Display QR code with copy-to-clipboard.
- Button to navigate to feed page.
- Export default.
- Return only code.

*/