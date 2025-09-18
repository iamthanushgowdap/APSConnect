// src/app/admin/resumes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminResumes() {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("users").select("id,name,usn,branch,semester,resume").eq("role","student");
      setStudents(data || []);
    }
    load();
  }, []);

  const filtered = students.filter(s => (`${s.name} ${s.usn} ${s.branch} ${s.semester}`.toLowerCase()).includes(search.toLowerCase()));

  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Student Resumes</h1>
      <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search by name/usn/branch" className="border p-2 rounded w-full mb-4" />
      <ul>
        {filtered.map(s => (
          <li key={s.id} className="bg-white p-3 rounded shadow mb-2">
            <h3 className="font-semibold">{s.name} ({s.usn})</h3>
            <p><strong>Branch:</strong> {s.branch} • <strong>Sem:</strong> {s.semester}</p>
            <p><strong>Summary:</strong> {s.resume?.summary || "N/A"}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
