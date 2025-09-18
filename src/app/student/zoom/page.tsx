// src/app/student/zoom/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Meeting = {
  id: string;
  title?: string;
  description?: string;
  zoom_link?: string | null;
  branch?: string | null;
  semester?: string | null;
  start_time?: string | null; // ISO
  created_at?: string | null;
};

function within15Min(iso?: string | null) {
  if (!iso) return false;
  const s = new Date(iso).getTime();
  const now = Date.now();
  const diff = s - now;
  return diff <= 1000 * 60 * 15 && diff >= -1000 * 60 * 10; // within -10min..+15min window
}

export default function StudentZoomPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) return;
        const { data: userRow } = await supabase.from("users").select("id,branch,semester").eq("auth_id", auth.user.id).single();
        if (!userRow?.id) return;
        if (!alive) return;
        setStudent(userRow);

        // fetch meetings for the student's branch/semester OR global ones (null)
        // using supabase 'or' to include global
        const branch = userRow.branch ?? "";
        const sem = userRow.semester ?? "";

        const filter = `and(branch.eq.${branch},semester.eq.${sem}),and(branch.is.null,semester.is.null),and(branch.eq.${branch},semester.is.null),and(branch.is.null,semester.eq.${sem})`;
        const { data } = await supabase.from("meetings").select("*").or(filter).order("start_time", { ascending: true });

        if (!alive) return;
        setMeetings(data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();

    // optionally subscribe to meeting inserts/updates (uncomment if desired)
    // const channel = supabase.channel('meetings-client').on('postgres_changes', { event: '*', schema: 'public', table: 'meetings'}, () => load()).subscribe();
    // return () => { alive = false; supabase.removeChannel(channel); };
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-6">Loading meetings…</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Online Meetings / Zoom</h1>

      {student && <div className="mb-3 text-sm text-gray-600">Showing meetings for <strong>{student.branch}</strong> — Sem <strong>{student.semester}</strong></div>}

      {meetings.length === 0 ? (
        <p>No meetings scheduled.</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((m) => {
            const startLabel = m.start_time ? new Date(m.start_time).toLocaleString() : "TBA";
            const canJoin = within15Min(m.start_time);
            return (
              <li key={m.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="text-sm text-gray-600">{m.description}</p>
                  <div className="text-xs text-gray-500 mt-1">Starts: {startLabel}</div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {canJoin && m.zoom_link ? (
                    <a href={m.zoom_link} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-3 py-1 rounded">Join Now</a>
                  ) : (
                    <div className="text-sm text-gray-500">Join link available 15 min before</div>
                  )}

                  {/* Export to calendar placeholder: create ICS file or use Google Calendar link */}
                  <a
                    href={`https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(m.title || "")}&details=${encodeURIComponent(m.description || "")}&dates=${m.start_time ? new Date(m.start_time).toISOString().replace(/-|:|\.\d+/g, "") : ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 underline"
                  >
                    Add to Google Calendar
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
