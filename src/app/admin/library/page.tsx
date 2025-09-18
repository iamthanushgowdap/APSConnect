// src/app/admin/library/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLibrary() {
  const [books, setBooks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("library").select("*").order("created_at", { ascending: false });
      setBooks(data || []);
    }
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("library").insert([{ title, author }]);
    const { data } = await supabase.from("library").select("*").order("created_at", { ascending: false });
    setBooks(data || []);
    setTitle(""); setAuthor("");
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Library</h1>
      <form onSubmit={add} className="bg-white p-4 rounded shadow mb-6">
        <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Book title" className="border p-2 rounded w-full mb-2" />
        <input value={author} onChange={(e)=>setAuthor(e.target.value)} placeholder="Author" className="border p-2 rounded w-full mb-2" />
        <button className="bg-green-600 text-white px-4 py-2 rounded">Add Book</button>
      </form>

      <ul>
        {books.map(b => (
          <li key={b.id} className="bg-white p-3 rounded shadow mb-2">
            <strong>{b.title}</strong> — {b.author}
          </li>
        ))}
      </ul>
    </main>
  );
}
