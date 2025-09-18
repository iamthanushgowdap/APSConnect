"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FacultyMeetings() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [startTime, setStartTime] = useState("");

  useEffect(() => {
    async function loadMeetings() {
      const { data } = await supabase
        .from("meetings")
        .select("*")
        .order("start_time", { ascending: true });
      setMeetings(data || []);
    }
    loadMeetings();
  }, []);

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: faculty } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!faculty) return;

    await supabase.from("notifications").insert([
  {
    user_id: null, // null means "all users in group"
    title: "New Meeting Scheduled",
    message: `📢 ${title} on ${new Date(startTime).toLocaleString()}`,
  },
]);

    setTitle("");
    setDescription("");
    setBranch("");
    setSemester("");
    setZoomLink("");
    setStartTime("");

    const { data } = await supabase
      .from("meetings")
      .select("*")
      .order("start_time", { ascending: true });
    setMeetings(data || []);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Faculty Meetings</h1>

      <form
        onSubmit={createMeeting}
        className="bg-white p-4 rounded shadow space-y-2 mb-6"
      >
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
          type="text"
          placeholder="Branch"
          className="border p-2 rounded w-full"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        />
        <input
          type="text"
          placeholder="Semester"
          className="border p-2 rounded w-full"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        />
        <input
          type="url"
          placeholder="Zoom Link"
          className="border p-2 rounded w-full"
          value={zoomLink}
          onChange={(e) => setZoomLink(e.target.value)}
        />
        <input
          type="datetime-local"
          className="border p-2 rounded w-full"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Create Meeting
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-2">Upcoming Meetings</h2>
      <ul>
        {meetings.map((m) => (
          <li key={m.id} className="bg-white p-3 rounded shadow mb-2">
            <h3 className="font-semibold">{m.title}</h3>
            <p>{m.description}</p>
            <p>
              {m.branch} — Sem {m.semester}
            </p>
            <p>⏰ {new Date(m.start_time).toLocaleString()}</p>
            <a
              href={m.zoom_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              🔗 Join Meeting
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
