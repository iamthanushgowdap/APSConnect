// src/app/faculty/exams/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Exam = { id: string; title: string; exam_type: string; created_at: string };
type TimetableRow = { id: string; exam_id: string; branch: string; semester: number; subject: string; exam_date: string; start_time?: string; end_time?: string };

export default function FacultyExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [message, setMessage] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadSubject, setUploadSubject] = useState("");

  useEffect(() => { loadExams(); }, []);

  async function loadExams() {
    const { data } = await supabase.from("exams").select("*").order("created_at", { ascending:false });
    setExams(data ?? []);
  }

  async function createExam() {
    const title = prompt("Exam title (e.g., Midterm 1)") || "";
    const exam_type = prompt("Exam type (midterm/internal/lab)") || "midterm";
    if (!title) return;
    const res = await fetch("/api/exams/create", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ title, exam_type }) });
    const j = await res.json();
    if (!res.ok) { setMessage("Create failed: " + (j.error || res.status)); return; }
    setMessage("Exam created");
    loadExams();
    setTimeout(()=>setMessage(""),3000);
  }

  async function openExam(e: Exam) {
    setSelectedExam(e);
    const { data } = await supabase.from("exam_timetable").select("*").eq("exam_id", e.id).order("exam_date", { ascending: true });
    setTimetable(data ?? []);
  }

  async function addTimetableRow() {
    if (!selectedExam) return setMessage("Select an exam first");
    if (!branch || !semester || !subject || !examDate) return setMessage("Fill branch/sem/subject/date");
    const res = await fetch("/api/exams/timetable/create", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ exam_id: selectedExam.id, branch, semester, subject, exam_date: examDate, start_time: startTime, end_time: endTime })});
    const j = await res.json();
    if (!res.ok) { setMessage("Add row failed: " + (j.error || res.status)); return; }
    setMessage("Row added");
    openExam(selectedExam);
    setBranch(""); setSemester(""); setSubject(""); setExamDate(""); setStartTime(""); setEndTime("");
    setTimeout(()=>setMessage(""),3000);
  }

  // simple CSV parser: expects student_id,marks,max_marks,grade per line
  function parseCsvText(text: string) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const arr: any[] = [];
    for (const ln of lines) {
      const p = ln.split(",").map(s => s.trim());
      if (p.length < 2) continue;
      arr.push({ student_id: p[0], marks: Number(p[1]) || 0, max_marks: Number(p[2]) || 100, grade: p[3] || null });
    }
    return arr;
  }

  async function uploadCsvMarks() {
    if (!selectedExam) return setMessage("Select exam");
    if (!uploadSubject) return setMessage("Enter subject");
    if (!csvFile) return setMessage("Choose CSV file");
    const txt = await csvFile.text();
    const marks = parseCsvText(txt);
    const res = await fetch("/api/results/upload", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ exam_id: selectedExam.id, subject: uploadSubject, marks }) });
    const j = await res.json();
    if (!res.ok) { setMessage("Upload failed: " + (j.error || res.status)); return; }
    setMessage("Marks uploaded: " + (j.inserted?.length ?? marks.length));
    setTimeout(()=>setMessage(""),4000);
  }

  async function publishResults() {
    if (!selectedExam) return setMessage("Select exam");
    if (!uploadSubject) return setMessage("Enter subject to publish");
    const res = await fetch("/api/results/publish", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ exam_id: selectedExam.id, subject: uploadSubject, branch, semester }) });
    const j = await res.json();
    if (!res.ok) { setMessage("Publish failed: " + (j.error || res.status)); return; }
    setMessage("Published — students notified");
    setTimeout(()=>setMessage(""),3000);
  }

  return (
    <main className="p-6 min-h-screen bg-gray-50 space-y-6">
      <h1 className="text-2xl font-bold">Faculty — Exams</h1>
      {message && <div className="p-2 rounded bg-green-100">{message}</div>}

      <div className="flex gap-2">
        <button onClick={createExam} className="bg-blue-600 text-white px-3 py-1 rounded">Create Exam</button>
        <button onClick={()=>loadExams()} className="bg-gray-200 px-3 py-1 rounded">Refresh</button>
      </div>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded shadow">
          <h2 className="font-semibold">Exams</h2>
          <ul className="divide-y">
            {exams.map(e => (
              <li key={e.id} className="p-2 flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.title} <span className="text-xs text-gray-500">({e.exam_type})</span></div>
                  <div className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>openExam(e)} className="bg-indigo-600 text-white px-2 py-1 rounded">Open</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-3 rounded shadow">
          <h2 className="font-semibold">Timetable & Marks</h2>
          {!selectedExam ? <p>Select exam to manage timetable & upload marks</p> : (
            <>
              <div className="mb-3 font-semibold">{selectedExam.title}</div>
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input placeholder="Branch" value={branch} onChange={(e)=>setBranch(e.target.value)} className="border p-2 rounded" />
                  <input placeholder="Semester" type="number" value={semester as any} onChange={(e)=>setSemester(Number(e.target.value))} className="border p-2 rounded" />
                  <input placeholder="Subject" value={subject} onChange={(e)=>setSubject(e.target.value)} className="border p-2 rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)} className="border p-2 rounded" />
                  <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="border p-2 rounded" />
                  <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="border p-2 rounded" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addTimetableRow} className="bg-green-600 text-white px-3 py-1 rounded">Add Row</button>
                </div>
              </div>

              <hr className="my-3" />
              <h3 className="font-semibold">Timetable Rows</h3>
              <ul className="divide-y">
                {timetable.map(t => (
                  <li key={t.id} className="p-2">
                    <div className="font-medium">{t.subject}</div>
                    <div className="text-xs text-gray-500">{t.branch} • Sem {t.semester} • {t.exam_date} {t.start_time ? `• ${t.start_time}-${t.end_time || ""}` : ""}</div>
                  </li>
                ))}
              </ul>

              <hr className="my-3" />
              <h3 className="font-semibold">Upload Marks (CSV)</h3>
              <input placeholder="Subject for upload/publish" value={uploadSubject} onChange={e=>setUploadSubject(e.target.value)} className="border p-2 rounded w-full mb-2" />
              <input type="file" accept=".csv" onChange={e=>setCsvFile(e.target.files?.[0] ?? null)} />
              <div className="flex gap-2 mt-2">
                <button onClick={uploadCsvMarks} className="bg-blue-600 text-white px-3 py-1 rounded">Upload CSV</button>
                <button onClick={publishResults} className="bg-yellow-600 text-white px-3 py-1 rounded">Publish & Notify</button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
