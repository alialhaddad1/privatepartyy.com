/*
Task: Generate event feed page for PrivatePartyy.com in Next.js + TypeScript.
File: src/pages/event/[id].tsx

Context:
- Shows all posts for a given event.
- User can like, comment, and optionally send DMs.
- Uses Feed.tsx to render list of PostCard components.
- Uses UploadWidget.tsx to upload images.
- Host-only button to go back to QR page if token indicates host.
- Fetch posts via GET /api/events/:id/posts?token=...
- Likes via POST /api/posts/:id/like
- Comments via GET / POST /api/posts/:id/comments
- Subscription-locked UI for some interactions (likes/comments/DMs).

Deliverable:
- React functional component with useEffect to fetch posts.
- Polling or manual refresh optional.
- Export default.
- Include logic to pass token param to child components.
- Return code only.
 */