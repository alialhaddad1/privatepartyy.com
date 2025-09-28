// Global TypeScript types for the prototype

export interface Post {
  id: string;
  event_id: string;
  uploader_name: string;
  image_url: string;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
}