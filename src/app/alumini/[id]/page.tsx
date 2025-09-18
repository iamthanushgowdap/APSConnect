"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

export default function AlumniProfile() {
  const { id } = useParams();
  const [alumni, setAlumni] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("*")
        .eq("id", id)
        .single();
      setAlumni(alumniData);

      const { data: msgData } = await supabase
        .from("alumni_messages")
        .select("*, users(name)")
        .eq("alumni_id", id)
        .order("created_at", { ascending: true });
      setMessages(msgData || []);
    }
    loadData();

    const channel = supabase
      .channel("alumni-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alumni_messages" },
        (payload) => {
          if (payload.new.alumni_id === id) {
            setMessages((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function sendMessage() {
    if (!newMessage.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: student } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!student) return;

    await supabase.from("alumni_messages").insert([
      {
        sender_id: student.id,
        alumni_id: id,
        message: newMessage,
      },
    ]);

    setNewMessage("");
  }

  if (!alumni) return <p>Loading...</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">{alumni.name}</h1>
      <p>
        {alumni.job_title} at {alumni.company || "N/A"}
      </p>
      <p>
        {alumni.branch} — Class of {alumni.graduation_year}
      </p>
      <p className="text-sm text-gray-600">{alumni.email}</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Messages</h2>
      <div className="h-60 overflow-y-auto bg-white p-3 border rounded mb-2">
        {messages.map((m, i) => (
          <p key={i} className="mb-1">
            <strong>{m.users?.name || "Student"}:</strong> {m.message}
          </p>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Send
        </button>
      </div>
    </main>
  );
}
