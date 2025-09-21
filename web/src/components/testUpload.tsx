"use client";

import { useState } from "react";
import { supabase } from "C:\\Users\\alial\\PrivatePartyy.com\\web\\src\\lib\\supabaseClient.ts";

export default function UploadPost() {
  const [file, setFile] = useState<File | null>(null);
  const [uploaderName, setUploaderName] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    const eventId = "test_event"; // all QR codes map here for prototype
    const filePath = `${eventId}/${Date.now()}-${file.name}`;

    // Upload image to storage
    const { error: uploadError } = await supabase.storage
      .from("event-photos")
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    // Get public URL (or signed URL if you want extra security)
    const { data: urlData } = supabase.storage
      .from("event-photos")
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Insert metadata into posts table
    const { error: insertError } = await supabase
      .from("posts")
      .insert({
        event_id: eventId,
        uploader_name: uploaderName || "Anonymous",
        image_url: imageUrl,
      });

    if (insertError) {
      console.error(insertError);
    } else {
      console.log("Post created!");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Your name"
        value={uploaderName}
        onChange={(e) => setUploaderName(e.target.value)}
      />
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}
