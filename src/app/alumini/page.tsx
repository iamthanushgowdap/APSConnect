"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AlumniPortal() {
  const [posts, setPosts] = useState<any[]>([]);
  const [type, setType] = useState("job");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPosts() {
      const { data } = await supabase
        .from("alumni_posts")
        .select("*, alumni(name, company)")
        .order("created_at", { ascending: false });
      setPosts(data || []);
    }
    loadPosts();
  }, []);

  async function addPost(e: React.FormEvent) {
    e.preventDefault();

    // For demo: fetch first alumni record (later: link with alumni login)
    const { data: alumni } = await supabase.from("alumni").select("id").limit(1).single();
    if (!alumni) {
      setMessage("❌ No alumni found. Add alumni record first.");
      return;
    }

    const { error } = await supabase.from("alumni_posts").insert([
      {
        alumni_id: alumni.id,
        type,
        title,
        description,
        link,
      },
    ]);

    if (error) setMessage("❌ " + error.message);
    else {
      setMessage("✅ Post added!");
      setTitle("");
      setDescription("");
      setLink("");

      const { data } = await supabase
        .from("alumni_posts")
        .select("*, alumni(name, company)")
        .order("created_at", { ascending: false });
      setPosts(data || []);
    }
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Alumni Portal</h1>
      {message && <p className="mb-4 text-blue-600">{message}</p>}

      {/* Form to add post */}
      <form onSubmit={addPost} className="bg-white p-4 rounded shadow mb-6 space-y-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="job">Job Opportunity</option>
          <option value="internship">Internship</option>
          <option value="experience">Experience</option>
          <option value="resource">Resource</option>
        </select>
        <input
          type="text"
          placeholder="Title"
          className="border p-2 rounded w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          className="border p-2 rounded w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="url"
          placeholder="Link (optional)"
          className="border p-2 rounded w-full"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Post
        </button>
      </form>

      {/* Display posts */}
      <h2 className="text-xl font-semibold mb-2">Shared by Alumni</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id} className="bg-white p-4 rounded shadow mb-3">
            <h3 className="font-semibold">{p.title}</h3>
            <p className="text-sm text-gray-600">
              {p.type.toUpperCase()} — by {p.alumni?.name} ({p.alumni?.company})
            </p>
            <p>{p.description}</p>
            {p.link && (
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                🔗 View More
              </a>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
