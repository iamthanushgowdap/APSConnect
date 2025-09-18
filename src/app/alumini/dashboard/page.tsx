"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AlumniDashboard() {
  const [alumni, setAlumni] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [postType, setPostType] = useState("job");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: alum } = await supabase
        .from("alumni")
        .select("*")
        .eq("auth_id", user.id)
        .single();
      setAlumni(alum);

      if (alum) {
        const { data: msgs } = await supabase
          .from("alumni_messages")
          .select("*, users(name, usn)")
          .eq("alumni_id", alum.id)
          .order("created_at", { ascending: true });
        setMessages(msgs || []);

        const { data: postsData } = await supabase
          .from("alumni_posts")
          .select("*")
          .eq("alumni_id", alum.id)
          .order("created_at", { ascending: false });
        setPosts(postsData || []);
      }
    }
    loadData();
  }, []);

  async function sendReply(studentId: string) {
    if (!reply.trim() || !alumni) return;
    await supabase.from("alumni_messages").insert([
      {
        sender_id: alumni.id, // replies appear as alumni
        alumni_id: alumni.id,
        message: reply,
      },
    ]);
    setReply("");
  }

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    if (!alumni) return;

    await supabase.from("alumni_posts").insert([
      {
        alumni_id: alumni.id,
        type: postType,
        title,
        description,
        link,
      },
    ]);

    setTitle("");
    setDescription("");
    setLink("");
    const { data: postsData } = await supabase
      .from("alumni_posts")
      .select("*")
      .eq("alumni_id", alumni.id)
      .order("created_at", { ascending: false });
    setPosts(postsData || []);
  }

  if (!alumni) return <p>Loading...</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Welcome, {alumni.name}</h1>

      {/* Messages */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Messages from Students</h2>
        <div className="bg-white p-4 rounded shadow h-60 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className="mb-3 border-b pb-2">
              <p>
                <strong>{m.users?.name} ({m.users?.usn}):</strong> {m.message}
              </p>
              <input
                type="text"
                placeholder="Reply..."
                className="border p-2 rounded w-full mt-1"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <button
                onClick={() => sendReply(m.sender_id)}
                className="bg-blue-600 text-white px-3 py-1 rounded mt-1"
              >
                Reply
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Add Post */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Share Opportunity</h2>
        <form onSubmit={addPost} className="bg-white p-4 rounded shadow space-y-2">
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="job">Job</option>
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
      </section>

      {/* Posts */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Your Posts</h2>
        <ul>
          {posts.map((p) => (
            <li key={p.id} className="bg-white p-3 rounded shadow mb-2">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-sm text-gray-600">{p.type.toUpperCase()}</p>
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
      </section>
    </main>
  );
}
