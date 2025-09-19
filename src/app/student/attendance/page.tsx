"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StudentAttendancePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [myRecords, setMyRecords] = useState<any[]>([]);
  const [qrToken, setQrToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false });
    setSessions(data ?? []);
    // fetch my records
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: uRow } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
    if (!uRow) return;
    const { data: recs } = await supabase.from("attendance_records").select("*, attendance_sessions(*)").eq("student_id", uRow.id).order("marked_at", { ascending: false });
    setMyRecords(recs ?? []);
  }

  async function markPresent(sessionId: string, method: 'manual'|'qr') {
    const payload: any = { session_id: sessionId, method };
    if (method === 'qr') {
      const token = prompt("Enter QR token (scan or paste):") || '';
      payload.qr_token = token;
    }
    const res = await fetch("/api/attendance/mark", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (!res.ok) setMessage("Mark failed: " + (j.error || res.status));
    else { setMessage("Marked"); load(); }
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Attendance</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Upcoming / Recent Sessions</h2>
        <ul>
          {sessions.map(s => (
            <li key={s.id} className="border-b py-2 flex justify-between">
              <div>
                <div className="font-semibold">{s.subject}</div>
                <div className="text-sm">{s.branch} Sem {s.semester} • {s.session_date}</div>
              </div>
              <div className="space-x-2">
                <button onClick={() => markPresent(s.id, 'manual')} className="px-2 py-1 bg-blue-600 text-white rounded">Mark</button>
                {s.qr_token && <button onClick={() => markPresent(s.id, 'qr')} className="px-2 py-1 bg-indigo-600 text-white rounded">Scan QR</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">My Records</h2>
        <ul>
          {myRecords.map(r => (
            <li key={r.id} className="border-b py-2">
              <div className="font-semibold">{r.attendance_sessions?.subject}</div>
              <div className="text-sm">Date: {r.attendance_sessions?.session_date} — Status: {r.status}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
