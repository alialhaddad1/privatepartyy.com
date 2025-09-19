/*
Task: Generate UploadWidget component in React + TypeScript.
File: src/components/UploadWidget.tsx

Context:
- Props: eventId, token
- Select image file, resize client-side (canvas), preview
- POST /api/uploads for signed URL
- PUT image to signed URL, then POST metadata to /api/events/:id/posts
- Show upload progress.
- Export default.
- Return code only.
*/