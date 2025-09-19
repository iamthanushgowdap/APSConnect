// src/app/admin/exams/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [examId, setExamId] = useState("");
  const [csvUrl, setCsvUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { loadExams(); }, []);

  async function loadExams() {
    const { data } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    setExams(data ?? []);
  }

  async function exportCsv() {
    if (!examId) return setMessage("Enter exam id");
    const res = await fetch(`/api/results/export?exam_id=${examId}`);
    if (!res.ok) {
      const j = await res.json();
      return setMessage("Export failed: " + (j.error || res.status));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setCsvUrl(url);
    setMessage("CSV ready — click download");
  }

  return (
    <main className="p-6 min-h-screen bg-gray-100 space-y-6">
      <h1 className="text-2xl font-bold">Admin — Exams</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <div className="bg-white p-3 rounded shadow">
        <h2 className="font-semibold">Exams</h2>
        <ul className="divide-y">
          {exams.map(e => (
            <li key={e.id} className="p-2 flex justify-between items-center">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-gray-500">{e.exam_type}</div>
              </div>
              <div className="text-sm text-gray-600">{e.created_at}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white p-3 rounded shadow max-w-lg">
        <input placeholder="Exam ID to export" value={examId} onChange={(e)=>setExamId(e.target.value)} className="border p-2 rounded w-full mb-2" />
        <div className="flex gap-2">
          <button onClick={exportCsv} className="bg-blue-600 text-white px-3 py-1 rounded">Export CSV</button>
          {csvUrl && <a href={csvUrl} download={`results_${examId}.csv`} className="bg-green-600 text-white px-3 py-1 rounded">Download</a>}
        </div>
      </div>
    </main>
  );
}
