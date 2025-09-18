"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FacultyResumes() {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadResumes() {
      const { data } = await supabase
        .from("users")
        .select("id, name, usn, resume")
        .eq("role", "student")
        .order("name", { ascending: true });

      setStudents(data || []);
    }
    loadResumes();
  }, []);

  const filtered = students.filter((s) =>
    `${s.name} ${s.usn}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Student Resumes</h1>
      <input
        type="text"
        placeholder="Search by name or USN"
        className="border p-2 rounded w-full mb-4"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p>No students found.</p>
      ) : (
        <ul>
          {filtered.map((s) => (
            <li key={s.id} className="bg-white p-4 rounded shadow mb-3">
              <h2 className="font-semibold">{s.name} ({s.usn})</h2>
              <p><strong>Summary:</strong> {s.resume?.summary || "N/A"}</p>
              <p><strong>Skills:</strong> {(s.resume?.skills || []).join(", ")}</p>
              <p><strong>Certifications:</strong> {(s.resume?.certifications || []).join(", ")}</p>
              <p><strong>Experience:</strong> {(s.resume?.experience || []).join(", ")}</p>
              <p><strong>Awards:</strong> {(s.resume?.awards || []).join(", ")}</p>
              <p><strong>Hobbies:</strong> {(s.resume?.hobbies || []).join(", ")}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
