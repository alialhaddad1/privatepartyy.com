/*
Task: Generate Profile page for PrivatePartyy.com in Next.js + TypeScript.
File: src/pages/profile/[id].tsx

Context:
- Displays user's initials, avatar, generation, optional socials.
- Uses ProfileSummary.tsx and UserPostsList.tsx components.
- GET /api/users/:id for public fields.
- GET /api/users/:id/posts for posts.
- Subscription gating: only show socials if viewer is subscribed.
- Minimal UI, mobile-friendly.

Deliverable:
- React functional component.
- Export default.
- Include fetching logic and conditional display of subscription-locked info.
- Return code only.
*/