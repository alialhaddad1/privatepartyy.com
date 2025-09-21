"use client";

import { useEffect, useState } from "react";
import { supabase } from "C:\\Users\\alial\\PrivatePartyy.com\\web\\src\\lib\\supabaseClient.ts";

interface Post {
  id: string;
  uploader_name: string;
  image_url: string;
  created_at: string;
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) console.error(error);
      else setPosts(data || []);
    };

    fetchPosts();
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      {posts.map((post) => (
        <div key={post.id} className="border p-2">
          <img src={post.image_url} alt="event" className="w-full h-auto" />
          <p className="text-sm text-gray-600">{post.uploader_name}</p>
          <p className="text-xs">{new Date(post.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
