// src/app/admin/announcements/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendNotification } from "@/lib/notify";

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      setAnnouncements(data || []);
    }
    load();
  }, []);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert([{ title, content }]);
    if (error) return alert(error.message);
    setTitle(""); setContent("");

    // notify all students & faculty
    const { data: users } = await supabase.from("users").select("id").in("role", ["student","faculty"]);
    users?.forEach(async (u) => {
      await sendNotification(u.id, `Announcement: ${title}`, content);
    });

    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setAnnouncements(data || []);
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Announcements</h1>
      <form onSubmit={post} className="bg-white p-4 rounded shadow mb-6 space-y-2">
        <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" className="border p-2 rounded w-full" />
        <textarea value={content} onChange={(e)=>setContent(e.target.value)} placeholder="Content" className="border p-2 rounded w-full" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Publish</button>
      </form>

      <ul>
        {announcements.map(a => (
          <li key={a.id} className="bg-white p-3 rounded shadow mb-2">
            <h3 className="font-semibold">{a.title}</h3>
            <p className="text-sm text-gray-600">{new Date(a.created_at).toLocaleString()}</p>
            <p>{a.content}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
