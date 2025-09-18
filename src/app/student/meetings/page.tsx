"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StudentMeetings() {
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    async function loadMeetings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: student } = await supabase
        .from("users")
        .select("branch, semester")
        .eq("auth_id", user.id)
        .single();
      if (!student) return;

      const { data } = await supabase
        .from("meetings")
        .select("*")
        .eq("branch", student.branch)
        .eq("semester", student.semester)
        .order("start_time", { ascending: true });

      setMeetings(data || []);
    }
    loadMeetings();
  }, []);

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">My Meetings</h1>
      {meetings.length === 0 ? (
        <p>No meetings scheduled.</p>
      ) : (
        <ul>
          {meetings.map((m) => (
            <li key={m.id} className="bg-white p-3 rounded shadow mb-2">
              <h3 className="font-semibold">{m.title}</h3>
              <p>{m.description}</p>
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
      )}
    </main>
  );
}
