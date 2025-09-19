// src/app/student/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TimetableRow = { id: string; exam_id: string; branch: string; semester: number; subject: string; exam_date: string; start_time?: string; end_time?: string };
type ResultRow = { subject: string; marks: number; max_marks: number; grade?: string };

export default function StudentResultsPage() {
  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [examId, setExamId] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState<{ total:number, totalMax:number, pct:number|null } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { loadTimetableForMe(); }, []);

  async function getMyUser() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data: u } = await supabase.from("users").select("id,branch,semester").eq("auth_id", auth.user.id).maybeSingle();
    return u;
  }

  async function loadTimetableForMe() {
    const u = await getMyUser();
    if (!u) return;
    const { data } = await supabase.from("exam_timetable").select("*").eq("branch", u.branch).eq("semester", u.semester).order("exam_date", { ascending: true });
    setTimetable(data ?? []);
  }

  async function loadResultsForExam(exam_id: string) {
    setExamId(exam_id);
    const res = await fetch(`/api/results/student-summary?exam_id=${exam_id}`);
    const j = await res.json();
    if (!res.ok) { setMessage(j.error || "Error"); return; }
    setResults(j.rows ?? []);
    setSummary({ total: j.total, totalMax: j.totalMax, pct: j.pct });
  }

  return (
    <main className="p-6 min-h-screen bg-gray-100 space-y-6">
      <h1 className="text-2xl font-bold">My Exam Timetable & Results</h1>
      {message && <div className="bg-red-100 p-2 rounded">{message}</div>}

      <section className="bg-white p-3 rounded shadow">
        <h2 className="font-semibold">Upcoming / Relevant Timetable</h2>
        {timetable.length === 0 ? <p>No timetable entries.</p> : (
          <ul className="divide-y">
            {timetable.map(t => (
              <li key={t.id} className="p-2 flex justify-between items-center">
                <div>
                  <div className="font-medium">{t.subject}</div>
                  <div className="text-xs text-gray-500">{t.exam_date} {t.start_time ? `• ${t.start_time}` : ""}</div>
                </div>
                <div>
                  <button onClick={() => loadResultsForExam(t.exam_id)} className="bg-blue-600 text-white px-2 py-1 rounded">View Results</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {results.length > 0 && (
        <section className="bg-white p-3 rounded shadow">
          <h2 className="font-semibold">Results for Exam {examId}</h2>
          <ul className="divide-y">
            {results.map((r,i)=>(
              <li key={i} className="p-2 flex justify-between items-center">
                <div>
                  <div className="font-medium">{r.subject}</div>
                  <div className="text-xs text-gray-500">Grade: {r.grade ?? "-"}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{r.marks}/{r.max_marks}</div>
                  <div className="text-xs text-gray-500">{Math.round((r.marks / r.max_marks)*10000)/100}%</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 bg-green-50 p-3 rounded">
            <div>Total: {summary?.total}/{summary?.totalMax}</div>
            <div>Percentage: {summary?.pct ?? "-"}%</div>
          </div>
        </section>
      )}
    </main>
  );
}
