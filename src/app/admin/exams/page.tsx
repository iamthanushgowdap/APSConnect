// src/app/admin/exams/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminExams() {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("exams").select("*").order("date", { ascending: true });
      setList(data || []);
    }
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("exams").insert([{ title, date }]);
    const { data } = await supabase.from("exams").select("*").order("date", { ascending: true });
    setList(data || []);
    setTitle(""); setDate("");
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Exam Timetable</h1>
      <form onSubmit={create} className="bg-white p-4 rounded shadow mb-6">
        <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Exam (e.g., DBMS)" className="border p-2 rounded w-full mb-2" />
        <input value={date} onChange={(e)=>setDate(e.target.value)} type="date" className="border p-2 rounded w-full mb-2" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
      </form>

      <ul>
        {list.map(x => (
          <li key={x.id} className="bg-white p-3 rounded shadow mb-2">
            <strong>{x.title}</strong> — {new Date(x.date).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </main>
  );
}
