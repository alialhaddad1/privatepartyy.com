/* 
Task: Generate DM page for PrivatePartyy.com in Next.js + TypeScript.
File: src/pages/dm/[threadId].tsx

Context:
- Displays messages between two users in a thread.
- Components: MessagesList.tsx, MessageInput.tsx
- GET /api/dms/:threadId for messages.
- POST /api/dms/:threadId/messages to send new message.
- Token validation required (user must be a participant).
- Subscription gating optional (hide DM input if not subscribed).

Deliverable:
- React functional component.
- Export default.
- Fetch messages on mount; update in real-time or via polling.
- Return code only.
*/