"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";

type Session = {
  id: string;
  branch: string;
  semester: number;
  subject: string;
  session_date: string;
  start_time?: string;
  end_time?: string;
  qr_token?: string | null;
  qr_expires_at?: string | null;
};

export default function FacultyAttendanceQRPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("*")
      .order("session_date", { ascending: false });

    if (error) setMessage("Error loading sessions");
    setSessions(data ?? []);
  }

  async function createSession() {
    const branch = prompt("Branch (e.g., CS)") || "";
    const semester = parseInt(prompt("Semester (1-8)") || "1");
    const subject = prompt("Subject") || "";
    const date =
      prompt("Date (YYYY-MM-DD)") || new Date().toISOString().slice(0, 10);
    const useQr = confirm("Enable QR sign-in for this session?");
    const body = {
      branch,
      semester,
      subject,
      session_date: date,
      use_qr: useQr,
    };

    const res = await fetch("/api/attendance/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const j = await res.json();
    if (!res.ok) {
      setMessage("Create failed: " + (j.error || res.status));
      return;
    }
    setMessage("Session created");
    load();
    setTimeout(() => setMessage(""), 3000);
  }

  function getQrPayload(session: Session) {
    return JSON.stringify({
      session_id: session.id,
      qr_token: session.qr_token,
    });
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Attendance — QR Sessions</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <div className="flex items-center space-x-3">
        <button
          onClick={createSession}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Create Session
        </button>
        <button
          onClick={load}
          className="bg-gray-200 px-3 py-1 rounded"
        >
          Refresh
        </button>
      </div>

      <section>
        <h2 className="font-semibold">Sessions</h2>
        <ul className="bg-white rounded shadow p-3 space-y-3">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="border p-3 rounded flex flex-col md:flex-row md:justify-between"
            >
              <div>
                <div className="font-semibold">{s.subject}</div>
                <div className="text-sm">
                  {s.branch} — Sem {s.semester} • {s.session_date}
                </div>
              </div>
              <div className="mt-2 md:mt-0 flex flex-col items-center">
                {s.qr_token ? (
                  <>
                    <QRCodeSVG value={getQrPayload(s)} size={140} />
                    <p className="text-xs mt-1 text-gray-600">
                      Expires at: {s.qr_expires_at || "—"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">QR not enabled</p>
                )}
                <button
                  onClick={() => setSelectedSession(s)}
                  className="mt-2 bg-indigo-600 text-white px-2 py-1 rounded"
                >
                  Manage
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
