"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminResultsPage() {
  const [examId, setExamId] = useState("");
  const [csvUrl, setCsvUrl] = useState("");

  async function exportCsv() {
    if (!examId) return alert("Enter exam id");
    const res = await fetch(`/api/results/export?exam_id=${examId}`);
    if (!res.ok) {
      const j = await res.json();
      alert("Export failed: " + (j.error || res.status));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setCsvUrl(url);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold">Admin — Results Export</h1>
      <div className="bg-white p-3 rounded shadow max-w-lg">
        <input placeholder="Exam ID" value={examId} onChange={e=>setExamId(e.target.value)} className="border p-2 rounded w-full" />
        <div className="flex gap-2 mt-2">
          <button onClick={exportCsv} className="bg-blue-600 text-white px-3 py-1 rounded">Export CSV</button>
          {csvUrl && <a href={csvUrl} download={`results_${examId}.csv`} className="bg-green-600 text-white px-3 py-1 rounded">Download</a>}
        </div>
      </div>
    </main>
  );
}
